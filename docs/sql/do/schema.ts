/**
 * Esquema del Durable Object de una rifa.
 *
 * Cada rifa tiene su propio SQLite. No existe un `ALTER TABLE` que alcance a
 * los 500 objetos a la vez: no hay lugar central desde donde correrlo. Por eso
 * el esquema se versiona con `PRAGMA user_version` y cada objeto migra **cuando
 * despierta**.
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
 *
 * Va en: src/do/schema.ts
 */

export const SCHEMA_VERSION = 1;

export const migrate = (sql: SqlStorage): void => {
  let version = sql
    .exec<{ user_version: number }>('PRAGMA user_version')
    .one().user_version;

  // ── v1 · esquema inicial ─────────────────────────────────────────────────
  if (version < 1) {
    // Config que el DO necesita para validar por su cuenta. La verdad de la
    // configuración vive en D1; esto es la copia que permite decidir sin
    // llamadas asíncronas en medio de una operación atómica.
    sql.exec(`
      CREATE TABLE meta (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      ) STRICT;
    `);

    // Compradores. El dato más sensible del sistema: nombres y teléfonos de
    // personas que se los dieron a la vecina, no a una plataforma.
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

    // Un teléfono es una persona dentro de la rifa. Evita que el vecino que
    // compró tres veces figure como tres compradores distintos.
    sql.exec(`
      CREATE UNIQUE INDEX buyers_phone_key
        ON buyers (phone) WHERE phone IS NOT NULL;
    `);

    // Pedidos del plan PRO. Se guardan los datos del visitante acá y no en
    // `buyers` porque todavía no es un comprador: puede no concretar nunca.
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

    // La grilla, materializada completa al crear la rifa.
    // Sin `raffle_id`: el objeto ES la rifa. Desaparece toda la clase de bugs
    // de "un comprador de otra rifa" que en Postgres había que atajar.
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

    version = 1;
  }

  // ── Los próximos escalones van acá abajo, sin tocar los de arriba ────────
  //
  // if (version < 2) {
  //   sql.exec(`ALTER TABLE numbers ADD COLUMN reserved_by_ip TEXT;`);
  //   version = 2;
  // }

  sql.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
};

/**
 * Materializa la grilla. Reemplaza al `generate_series()` de Postgres.
 *
 * Se inserta en lotes para no armar una sentencia con 10.000 parámetros:
 * SQLite tiene un límite de variables por statement.
 */
export const seedNumbers = (
  sql: SqlStorage,
  numberStart: number,
  totalNumbers: number,
): void => {
  const now = Date.now();
  const LOTE = 500;

  for (let base = 0; base < totalNumbers; base += LOTE) {
    const cantidad = Math.min(LOTE, totalNumbers - base);
    const valores: number[] = [];
    const marcas: string[] = [];

    for (let i = 0; i < cantidad; i++) {
      valores.push(numberStart + base + i, now);
      marcas.push('(?, ?)');
    }

    sql.exec(
      `INSERT INTO numbers (number, updated_at) VALUES ${marcas.join(',')}`,
      ...valores,
    );
  }
};

/** Claves de `meta`. La copia local de la config que el DO valida. */
export type MetaKey =
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
