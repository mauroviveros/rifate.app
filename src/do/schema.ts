/**
 * Esquema del Durable Object de una rifa.
 *
 * Cada rifa tiene su propio SQLite. No existe un `ALTER TABLE` que alcance a
 * los 500 objetos a la vez: no hay lugar central desde donde correrlo. Por eso
 * el esquema se versiona y cada objeto migra **cuando despierta**.
 *
 * ⚠️ El versionado NO usa `PRAGMA user_version`: el SQLite de un Durable Object
 * lo rechaza con `not authorized: SQLITE_AUTH`. Está dicho en la doc oficial
 * ("PRAGMA user_version is not supported by Durable Objects SQLite storage") y
 * verificado en runtime acá. La alternativa que recomienda Cloudflare es
 * llevar el registro en una tabla propia, que es lo que hace `_migrations`.
 *
 * REGLAS QUE HACEN QUE ESTO FUNCIONE A LARGO PLAZO
 *
 *   1. Los bloques `if (version < N)` NO SE EDITAN NUNCA. Se agregan.
 *      Un objeto que estuvo dormido dos meses tiene que poder recorrer todos
 *      los escalones desde donde quedó.
 *   2. Sólo hacia adelante. No hay rollback: no sabés en qué versión está cada
 *      objeto.
 *   3. `migrate()` se llama SÓLO desde el constructor, dentro de
 *      `blockConcurrencyWhile`. Nunca por request.
 *   4. Un objeto que nadie abre no migra, y está bien: migra la próxima vez que
 *      alguien entre a esa rifa.
 */

export const SCHEMA_VERSION = 1;

/** Deja constancia de que el escalón `v` ya corrió, y lo devuelve. */
const aplicado = (sql: SqlStorage, v: number): number => {
  sql.exec('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)', v, Date.now());
  return v;
};

export const migrate = (sql: SqlStorage): void => {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    ) STRICT;
  `);

  let version = sql
    .exec<{ version: number }>(
      'SELECT COALESCE(MAX(id), 0) AS version FROM _migrations',
    )
    .one().version;

  // ── v1 · esquema inicial ─────────────────────────────────────────────────
  if (version < 1) {
    // Config que el DO necesita para validar por su cuenta.
    sql.exec(`
      CREATE TABLE meta (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      ) STRICT;
    `);

    // Compradores. El dato más sensible del sistema
    // Vive acá y NO en D1 precisamente para que no exista una tabla global.
    sql.exec(`
      CREATE TABLE buyers (
        id         TEXT    PRIMARY KEY,
        name       TEXT    NOT NULL,
        phone      TEXT,
        note       TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,

        CHECK (length(name) BETWEEN 1 AND 100),
        CHECK (note IS NULL OR length(note) <= 500)
      ) STRICT;
    `);

    // Un teléfono es una persona dentro de la rifa.
    sql.exec(`
      CREATE UNIQUE INDEX buyers_phone_key
        ON buyers (phone) WHERE phone IS NOT NULL;
    `);

    // Pedidos del pla PRO. Se guardan los datos del visitante acá
    // y no en D1 porque todavia no es un comprador
    sql.exec(`
      CREATE TABLE orders (
        id            TEXT    PRIMARY KEY,
        code          TEXT    NOT NULL UNIQUE,   -- 'A3F91C', para el chat
        visitor_token TEXT    NOT NULL UNIQUE,   -- credencial del visitante
        buyer_name    TEXT    NOT NULL,
        buyer_phone   TEXT,
        buyer_id      TEXT    REFERENCES buyers(id) ON DELETE SET NULL,
        status        TEXT    NOT NULL DEFAULT 'PENDING',
        expires_at    INTEGER NOT NULL,
        confirmed_at  INTEGER,
        cancelled_at  INTEGER,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL,

        CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED')),
        CHECK (length(buyer_name) BETWEEN 1 AND 100),
        CHECK (status <> 'CONFIRMED' OR buyer_id IS NOT NULL)
      ) STRICT;
    `);

    // La grilla de números de la rifa.
    // Sin `raffle_id`, el objeto ES LA RIFA.
    sql.exec(`
      CREATE TABLE numbers (
        number         INTEGER PRIMARY KEY,
        status         TEXT    NOT NULL DEFAULT 'AVAILABLE',
        buyer_id       TEXT    REFERENCES buyers(id) ON DELETE SET NULL,
        order_id       TEXT    REFERENCES orders(id) ON DELETE SET NULL,
        reserved_until INTEGER,
        sold_at        INTEGER,
        note           TEXT,
        updated_at     INTEGER NOT NULL,

        CHECK (status IN ('AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED')),
        CHECK (note IS NULL OR length(note) <= 280),

        -- Un número vendido sin comprador es un número perdido: nadie sabe a
        -- quién avisarle si gana.
        CHECK (status <> 'SOLD' OR buyer_id IS NOT NULL),

        -- Una reserva sin vencimiento queda trabada para siempre y el número
        -- no vuelve nunca a estar disponible.
        CHECK (status <> 'RESERVED' OR reserved_until IS NOT NULL)
      ) STRICT;
    `);

    sql.exec(`CREATE INDEX numbers_status_idx ON numbers (status);`);
    sql.exec(`
      CREATE INDEX numbers_expiring_idx ON numbers (reserved_until)
        WHERE status = 'RESERVED';
    `);
    sql.exec(`
      CREATE INDEX orders_pending_idx ON orders (status, created_at DESC);
    `);

    version = aplicado(sql, 1);
  }

  // ── Los próximos escalones van acá abajo, sin tocar los de arriba ────────
  //
  // if (version < 2) {
  //   sql.exec(`ALTER TABLE numbers ADD COLUMN reserved_by_ip TEXT;`);
  //   version = aplicado(sql, 2);
  // }

  // Red de contención: si alguien agrega un escalón y se olvida de el
  // `version = aplicado(sql, N)`, el objeto queda a medio migrar y sin
  // registro. Preferimos que explote acá, en el constructor, y no más tarde
  // con un "no such column" en medio de una venta.
  if (version !== SCHEMA_VERSION) {
    throw new Error(
      `migrate() terminó en v${version}, pero SCHEMA_VERSION es v${SCHEMA_VERSION}`,
    );
  }
};

/**
 * Materializa la grilla. Reemplaza al `generate_series()` de Postgres.
 *
 * ⚠️ NO se arma un `VALUES (?, ?), (?, ?), …` por lotes: el límite de variables
 * por statement es de 100 (los límites de SQL son los mismos que los de D1), y
 * un lote de 500 filas manda 1000 y falla con `too many SQL variables`.
 *
 * En cambio la serie la genera SQLite con un CTE recursivo: un solo statement,
 * tres parámetros, sin importar si la rifa tiene 100 números o 10.000.
 */
export const seedNumbers = (
  sql: SqlStorage,
  numberStart: number,
  totalNumbers: number,
): void => {
  sql.exec(
    `WITH RECURSIVE serie(n) AS (
       SELECT ?1
       UNION ALL
       SELECT n + 1 FROM serie WHERE n + 1 < ?1 + ?2
     )
     INSERT INTO numbers (number, updated_at) SELECT n, ?3 FROM serie`,
    numberStart,
    totalNumbers,
    Date.now(),
  );
};

/** Claves de `meta`. La copia local de la config que el DO valida. */
export type MetaKey =
  // El id de la rifa en D1. Se guarda explícito y NO se usa `ctx.id.name`:
  // en los tipos es `readonly name?: string` — opcional, sólo viene poblado
  // si el objeto se creó con getByName/idFromName. Depender de eso se rompe
  // en silencio. La fase 5 lo necesita para saber qué fila proyectar.
  | 'raffle_id'
  | 'owner_id'      // quién puede escribir  → assertOwner
  | 'tier'          // BASIC | PRO           → habilita pedidos
  | 'status'        // DRAFT | PUBLISHED | … → habilita pedidos
  | 'number_start'
  | 'total_numbers';

export const getMeta = (sql: SqlStorage, key: MetaKey): string | null =>
  sql.exec<{ v: string }>('SELECT v FROM meta WHERE k = ?', key).toArray()[0]?.v ?? null;

export const setMeta = (sql: SqlStorage, key: MetaKey, value: string): void => {
  sql.exec(
    `INSERT INTO meta (k, v) VALUES (?, ?)
     ON CONFLICT (k) DO UPDATE SET v = excluded.v`,
    key,
    value,
  );
};
