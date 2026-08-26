# 09 · Durable Objects: qué son y si los usamos

## El modelo mental

> Un Durable Object es **un servidorcito dedicado a una sola cosa**, con su
> propia base de datos privada, que atiende **un pedido por vez**.

En rifate.app esa "cosa" sería una rifa. Si tenés 500 rifas, tenés 500 Durable
Objects, cada uno con su grilla, sus compradores y sus pedidos adentro.

Tres propiedades, y las tres importan acá:

### 1 · Existe exactamente uno, en todo el mundo

Lo direccionás por nombre. Cloudflare garantiza que sólo hay una instancia viva
para ese nombre, en todo el planeta.

```ts
const rifa = env.RAFFLE.getByName('rifa-del-club-2026');
```

Dos requests desde Buenos Aires y desde Córdoba llegan **al mismo objeto**. No
hay réplicas que sincronizar porque no hay réplicas.

### 2 · Atiende un pedido por vez

Esta es la que cambia todo. Los requests al mismo DO se **encolan**. Nunca hay
dos ejecutándose en paralelo dentro del mismo objeto.

### 3 · Tiene su propia base SQLite y puede dormir

El storage vive pegado al objeto, es transaccional, y las consultas son
**síncronas** (no llevan `await`). Cuando nadie lo usa, el objeto hiberna y deja
de costar; despierta con su storage intacto.

---

## Por qué esto importa para una rifa

El problema más difícil de esta app: **dos personas piden el número 45 con
milisegundos de diferencia.**

### En D1 (sin Durable Objects)

```ts
// ⛔ ESTO ESTÁ MAL Y NO SE PUEDE ARREGLAR MIRÁNDOLO
const ocupados = await db
  .prepare('SELECT number FROM numbers WHERE number IN (?) AND status != ?')
  .bind(45, 'AVAILABLE').all();                                    // ①

if (ocupados.results.length > 0) return { error: 'NO_DISPONIBLE' };

await db
  .prepare('UPDATE numbers SET status = ? WHERE number = ?')
  .bind('RESERVED', 45).run();                                     // ②
```

**Entre ① y ② hay una ventana.** Otro request puede pasar el chequeo ① mientras
el primero todavía no llegó a ②. Los dos creen que el 45 está libre. Los dos lo
reservan.

En D1 la única salida es no separar la decisión de la escritura: meter la
condición **dentro** del `UPDATE` y después contar filas afectadas.

```ts
const r = await db.prepare(`
  UPDATE numbers SET status = 'RESERVED', order_id = ?
   WHERE number IN (45, 77) AND status = 'AVAILABLE'
`).bind(orderId).run();

if (r.meta.changes !== 2) {
  // Se reservó de menos. Pero el UPDATE YA se aplicó a los que sí estaban
  // libres, y el pedido ya se insertó. Hay que compensar a mano...
}
```

Y como `batch()` no permite ramificar en el medio (leer, decidir en JavaScript,
escribir), para abortar hace falta el truco de la tabla que falla a propósito:

```sql
CREATE TABLE _abort (id INTEGER PRIMARY KEY CHECK (id = -1));

-- último statement del batch: si no se reservaron todos, viola el CHECK,
-- tira error y hace rollback de todo el batch.
INSERT INTO _abort (id)
SELECT 1 WHERE (SELECT COUNT(*) FROM numbers WHERE order_id = ?1) <> ?2;
```

Funciona. Pero es un truco, y en seis meses nadie recuerda por qué está ahí.

### En un Durable Object

```ts
import { DurableObject } from 'cloudflare:workers';

export class Raffle extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // blockConcurrencyWhile sólo para crear el esquema, nunca por request.
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS numbers (
          number         INTEGER PRIMARY KEY,
          status         TEXT NOT NULL DEFAULT 'AVAILABLE',
          buyer_id       TEXT,
          order_id       TEXT,
          reserved_until INTEGER
        );
        CREATE TABLE IF NOT EXISTS orders (
          id          TEXT PRIMARY KEY,
          buyer_name  TEXT NOT NULL,
          buyer_phone TEXT,
          status      TEXT NOT NULL DEFAULT 'PENDING',
          expires_at  INTEGER NOT NULL
        );
      `);
    });
  }

  reserve(numeros: number[], nombre: string, telefono: string | null) {
    const ahora = Date.now();
    const marcas = numeros.map(() => '?').join(',');

    // ① LEER
    const ocupados = this.ctx.storage.sql.exec<{ number: number }>(
      `SELECT number FROM numbers
        WHERE number IN (${marcas})
          AND NOT (status = 'AVAILABLE'
               OR (status = 'RESERVED' AND reserved_until < ?))`,
      ...numeros, ahora,
    ).toArray();

    // ② DECIDIR
    if (ocupados.length > 0) {
      return { ok: false as const, ocupados: ocupados.map((o) => o.number) };
    }

    // ③ ESCRIBIR
    const orderId = crypto.randomUUID();
    const vence = ahora + 24 * 60 * 60 * 1000;

    this.ctx.storage.sql.exec(
      `INSERT INTO orders (id, buyer_name, buyer_phone, expires_at)
       VALUES (?, ?, ?, ?)`,
      orderId, nombre, telefono, vence,
    );

    this.ctx.storage.sql.exec(
      `UPDATE numbers
          SET status = 'RESERVED', order_id = ?, reserved_until = ?
        WHERE number IN (${marcas})`,
      orderId, vence, ...numeros,
    );

    // Libera los números si nadie confirma. Un alarm por objeto.
    this.ctx.storage.setAlarm(vence);

    return { ok: true as const, orderId, vence };
  }

  async alarm() {
    const ahora = Date.now();
    this.ctx.storage.sql.exec(
      `UPDATE numbers SET status = 'AVAILABLE', order_id = NULL, reserved_until = NULL
        WHERE status = 'RESERVED' AND reserved_until < ?`, ahora);
    this.ctx.storage.sql.exec(
      `UPDATE orders SET status = 'EXPIRED'
        WHERE status = 'PENDING' AND expires_at < ?`, ahora);
  }
}
```

**Leer, decidir y después escribir es seguro acá.** Entre ①, ② y ③ no puede
pasar nada, porque el objeto no atiende otro request hasta terminar este.

> Esa es toda la diferencia, y es enorme: en D1 la venta doble es un problema
> que **resolvés con cuidado**; en un DO es un problema que **no existe**.

Y lo llamás como si fuera una función normal:

```ts
const rifa = env.RAFFLE.getByName(raffleId);
const resultado = await rifa.reserve([45, 77], 'Ana', '+5493411234567');
```

Sin `fetch`, sin serializar a JSON. Eso es RPC de Durable Objects.

---

## El estado en vivo, casi gratis

Esto es lo que hoy no tenés y es el diferencial que buscás: que la grilla se
actualice sola en la pantalla de todos los que están mirando la rifa.

```ts
export class Raffle extends DurableObject<Env> {
  async fetch(request: Request) {
    const par = new WebSocketPair();
    this.ctx.acceptWebSocket(par[1]);   // hibernable: no cuesta mientras espera
    return new Response(null, { status: 101, webSocket: par[0] });
  }

  private avisar() {
    const grilla = this.ctx.storage.sql
      .exec('SELECT number, status FROM numbers').toArray();

    for (const ws of this.ctx.getWebSockets()) {
      ws.send(JSON.stringify({ tipo: 'grilla', grilla }));
    }
  }

  sell(numeros: number[], comprador: string) {
    // ... escribir ...
    this.avisar();   // ← todos los que están mirando la rifa lo ven al instante
  }
}
```

`acceptWebSocket` usa la **API de hibernación**: el objeto se puede dormir con
las conexiones abiertas y despertar cuando llega un mensaje. Cien personas
mirando una rifa quieta no cuestan nada.

Con Supabase esto era sumar Realtime. Acá son veinte líneas.

---

## Los costos, sin maquillaje

### 1 · No podés consultar entre rifas

Un DO sólo sabe de sí mismo. **"Listame mis rifas" es imposible de responder
desde un DO**, y es la primera pantalla del dashboard.

La solución es un índice en D1 que el DO actualiza al escribir:

```sql
-- D1: el catálogo. Una fila por rifa, sin la grilla.
CREATE TABLE raffles (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'DRAFT',
  tier          TEXT NOT NULL DEFAULT 'BASIC',
  ticket_price  INTEGER NOT NULL,      -- centavos, nunca REAL
  total_numbers INTEGER NOT NULL,
  number_start  INTEGER NOT NULL DEFAULT 0,
  draw_date     TEXT NOT NULL,
  sold_count    INTEGER NOT NULL DEFAULT 0,   -- ← desnormalizado, lo actualiza el DO
  updated_at    INTEGER NOT NULL
);
```

**Eso es dos fuentes de verdad para `sold_count`.** La real vive en el DO, la
copia vive en D1. Si una escritura al índice falla, quedan desincronizadas.
Es el costo concreto de esta arquitectura y hay que asumirlo.

Mitigación: el DO actualiza D1 después de escribir lo suyo, y el índice se
trata como **caché reconstruible**, no como fuente. Si divergen, gana el DO.

### 2 · Para Argentina, el objeto vive en Norteamérica

De la documentación de Cloudflare:

> `sam` (South America): *"Durable Objects currently do not spawn in this
> location. (…) Durable Objects hinted to South America spawn in Eastern North
> America instead."*

O sea: el DO de tu rifa va a vivir en **ENAM**, ~120-150 ms desde Buenos Aires.
Lo mismo que las réplicas de D1, así que no es peor que la alternativa — pero no
esperes magia de latencia.

En la práctica no duele, por dónde cae cada cosa:

| Operación | Frecuencia | Pasa por el DO | ¿Se nota? |
|---|---|---|---|
| Ver la página pública | Altísima | **No** (cache de CDN) | No |
| Reservar números | Baja | Sí | 150 ms sobre una acción humana: no |
| Vender a mano | Baja | Sí | No |
| Listar mis rifas | Media | **No** (va a D1) | No |

### 3 · Más piezas que entender

Un DO por rifa suma: `getByName`, RPC, `blockConcurrencyWhile`, alarms,
hibernación de WebSockets, migraciones de clases en `wrangler.jsonc`, y el
índice en D1. Debuggear estado repartido en N objetos es más difícil que mirar
una tabla.

**Para tu objetivo eso es una feature, no un costo.** Pero conviene decirlo.

---

## Recomendación: híbrido

**D1 para lo que se consulta entre rifas. Un Durable Object por rifa para lo que
vive dentro de una.**

```
┌─ D1 ────────────────────────────────────────────┐
│  users · sessions · accounts   (Better Auth)     │
│  profiles                                        │
│  raffles     ← catálogo: dueño, título, contadores│
│  vouchers · voucher_redemptions                  │
└──────────────────────────────────────────────────┘
                      │  el DO actualiza el catálogo al escribir
                      ▼
┌─ Durable Object · uno por rifa ─────────────────┐
│  numbers   ← la grilla completa                  │
│  buyers    ← nombres y teléfonos                 │
│  orders    ← pedidos con reserva                 │
│  + WebSockets de quienes están mirando           │
│  + alarm que vence las reservas                  │
└──────────────────────────────────────────────────┘
```

**Por qué encaja tan bien acá:** tus datos ya están perfectamente particionados
por rifa. Salvo "listar mis rifas", *toda* consulta y *toda* escritura pertenece
a una sola rifa. Esa es exactamente la forma de un Durable Object — no lo estás
forzando.

Y resuelve de una las tres cosas más difíciles del proyecto:

| Problema | Cómo se resuelve |
|---|---|
| Venta doble del mismo número | Imposible por construcción |
| Estado en vivo en la página pública | WebSockets hibernables, 20 líneas |
| Vencimiento de reservas | Un `alarm` por rifa, sin cron global |

> Ojo con una tentación: **Better Auth va en D1, no en un DO.** Las sesiones se
> consultan en cada request y no pertenecen a ninguna rifa.

## La alternativa, si preferís simplicidad

**Sólo D1**, con el truco de la tabla `_abort` para la atomicidad. Una fuente de
verdad, menos conceptos, más fácil de debuggear. A cambio: la venta doble pasa a
ser algo que resolvés con cuidado en vez de algo imposible, no hay estado en
vivo sin polling, y el vencimiento de reservas necesita un Cron Trigger global.

Es una decisión defendible. Pero dado que elegiste este stack **para aprenderlo**,
saltearte los Durable Objects sería saltearte la parte más interesante — y en
este caso además es la que mejor encaja con el problema.

---

# Costos

## Cómo se factura un DO

Tres dimensiones. La que sorprende a todo el mundo es la segunda.

| | Free | Paid |
|---|---|---|
| **Requests** | 100.000/día | 1 M/mes incluidos, luego **$0,15/millón** |
| **Duración** | 13.000 GB-s/día | 400.000 GB-s/mes incluidos, luego **$12,50/millón GB-s** |
| **Storage SQLite** | 5 M filas leídas/día · 100 k escritas/día · 5 GB | 25 mil M leídas/mes · 50 M escritas/mes · 5 GB-mes, luego $0,20/GB-mes |

Dos reglas que definen todo lo demás:

> **1 · Un DO hibernando no cuesta duración. Nada.**
> Se factura tiempo de reloj mientras el objeto está **activo o en memoria sin
> poder hibernar**. Un objeto inactivo y elegible para hibernar no paga, ni
> siquiera en la ventana antes de que el runtime lo duerma.

> **2 · La duración se cobra por 128 MB de memoria, uses lo que uses.**
> No importa que tu rifa ocupe 80 KB: pagás como si ocupara 128 MB. Por eso lo
> que importa es **cuántos segundos está despierto**, no cuánto pesa.

Un "request" incluye llamadas HTTP, **sesiones RPC**, mensajes de WebSocket
(con ratio 1/20) e invocaciones de alarm. Cada llamada a un método RPC del stub
es una sesión, o sea un request facturado.

## Cuánto cuesta una rifa de rifate.app

Modelo de una rifa real: 500 números, 30 días de vida, ~200 ventas cargadas por
el organizador, ~100 pedidos del plan PRO, y la página pública compartida en
WhatsApp.

**Storage — irrelevante**

```
500 filas en numbers   ≈ 25 KB
200 compradores        ≈ 20 KB
100 pedidos            ≈ 15 KB
SQLite vacío + metadata≈ 15 KB
                       ─────────
por rifa               ≈ 75-100 KB
```

Con 5 GB incluidos: **~50.000 rifas antes de pagar un peso de storage.**

**Duración — lo que hay que mirar**

Sólo cuenta el tiempo despierto:

```
200 ventas   × ~50 ms  = 10 s
100 pedidos  × ~50 ms  =  5 s
alarms + varios        =  5 s
lecturas que escapan al cache de CDN ≈ 40 s
                        ──────────
por rifa, por mes       ≈ 60 s activos

60 s × 128 MB / 1 GB    = 7,7 GB-s por rifa
```

Con 400.000 GB-s incluidos: **~52.000 rifas por mes antes de pagar duración.**

**Requests**

~300 operaciones de escritura por rifa. Con 1 millón incluido: **~3.300 rifas
por mes** antes de pagar, y después $0,15 el millón.

### La cuenta final

| Escenario | Rifas activas/mes | Costo |
|---|---|---|
| Arrancando | 50 | **$5** (el mínimo de Workers Paid) |
| Andando bien | 500 | **$5** |
| Creciendo | 5.000 | **~$5,15** |

> **El costo de los Durable Objects en este proyecto es, en la práctica, cero.**
> Lo que pagás es el mínimo de $5/mes del plan Workers Paid, que ibas a pagar
> igual por el resto de la app.
>
> Y sigue siendo 4× más barato que los $20/mes de Vercel Pro.

## ⚠️ La trampa: `accept()` vs `acceptWebSocket()`

Acá está la única forma de hacer explotar la factura, y es una línea de código.

```ts
// ✅ BIEN — API de hibernación. El objeto duerme con las conexiones abiertas.
this.ctx.acceptWebSocket(par[1]);

// ⛔ MAL — el objeto queda en memoria TODO el tiempo que dure la conexión.
par[1].accept();
```

Con `accept()`, el DO factura duración de forma continua mientras alguien esté
conectado, aunque no pase absolutamente nada. Los ejemplos de la propia
documentación de Cloudflare:

| Caso | Costo/mes |
|---|---|
| 100 DOs, WebSockets **sin** hibernación, 8 h/día | **$142,95** |
| 100 DOs, WebSockets **sin** hibernación, todo el mes | **$419,30** |
| 100 DOs × 100 conexiones **con** hibernación | **$20,65** |

Misma funcionalidad. La diferencia es qué método llamaste.

En rifate el caso es todavía mejor que el ejemplo de Cloudflare: los visitantes
**sólo escuchan**, no mandan mensajes. Los mensajes entrantes —que son los que
se facturan— son prácticamente cero, y el objeto sólo despierta cuando el
organizador vende un número.

### Otras dos formas de no hibernar

1. **Conexiones salientes.** Un `connect()` TCP o un WebSocket saliente mantienen
   el objeto vivo hasta 15 minutos, facturando. Un `fetch()` común **no** lo
   hace — tampoco las llamadas al binding de D1, así que actualizar el índice
   desde el DO es seguro.
2. **`blockConcurrencyWhile()` por request.** Sólo va en el constructor, para
   crear el esquema. Usarlo en cada request mata el throughput y suma duración.

## Regla operativa

> El costo de un Durable Object no depende de cuántos tenés ni de cuánto
> guardan. Depende de **cuántos segundos por mes están despiertos**.
>
> 10.000 rifas dormidas cuestan lo mismo que ninguna. Una sola rifa con un
> WebSocket mal aceptado cuesta más que las 10.000 juntas.

Para monitorearlo: dashboard de Cloudflare → **Workers & Pages → tu Worker →
Metrics**, y la sección de Durable Objects muestra requests y GB-s. Si la
duración empieza a subir sin que suba el uso, es un objeto que no está
hibernando.

---

# Consumo estimado de la app completa

Los números de arriba son sólo de los Durable Objects. Esto es **la factura
entera**: Workers, D1, DOs y Browser Run juntos.

## El modelo de una rifa

Una rifa promedio, sobre sus 30 días de vida:

| Variable | Valor |
|---|---|
| Números | 500 |
| Ventas cargadas | 200 |
| Pedidos del plan PRO | 100 |
| Visitas a la página pública | 2.000 |
| — de las que escapan al cache de CDN (~20 %) | 400 |
| Fetches de la imagen OG por crawlers | 50 |
| Visitas del organizador a su dashboard | 60 |
| Imagen descargable generada | 3 |

De ahí sale, por rifa:

```
Workers   ~2.250 requests · ~25 s de CPU
D1        ~4.000 filas leídas · ~300 escritas · ~300 bytes
DO          ~800 requests · ~4,4 GB-s · ~100 KB
BrowserRun  ~6 s de navegador
```

> La página pública que **sí** llega al Worker consulta el catálogo en D1 y la
> grilla en el DO. Por eso las 400 lecturas no cacheadas aparecen en las dos
> columnas. Es el motivo por el que el cache de CDN de 30 s no es una
> optimización opcional: es lo que mantiene los tres servicios en el free tier.

## La factura, por escala

| | 50 rifas/mes | 500 rifas/mes | 5.000 rifas/mes | 50.000 rifas/mes |
|---|---|---|---|---|
| **Workers** requests | 113 k | 1,1 M | 11,3 M → $0,38 | 113 M → $30,75 |
| **Workers** CPU | 1,3 M ms | 12,5 M ms | 125 M ms → $1,90 | 1,25 mil M → $24,40 |
| **D1** filas leídas | 200 k | 2 M | 20 M | 200 M |
| **D1** filas escritas | 15 k | 150 k | 1,5 M | 15 M |
| **DO** requests | 40 k | 400 k | 4 M → $0,45 | 40 M → $5,85 |
| **DO** duración | 220 GB-s | 2.200 GB-s | 22.000 GB-s | 220.000 GB-s |
| **DO** storage | 5 MB | 50 MB | 500 MB | 5 GB |
| **Browser Run** | 5 min | 50 min | 8,3 h | 83 h → $6,57 |
| | | | | |
| **TOTAL** | **$5** | **$5** | **~$7,75** | **~$73** |

*(Los $5 son el mínimo del plan Workers Paid. Todo lo demás entra en lo incluido
hasta las columnas marcadas.)*

## Qué leer de esta tabla

**1 · Hasta ~3.000 rifas por mes pagás $5 y nada más.** Todo entra en lo
incluido del plan. Para dimensionar: 3.000 rifas por mes son 100 rifas nuevas
por día, todos los días.

**2 · Los Durable Objects no son el costo.** Ni a 50.000 rifas/mes. La duración
—que es lo que asusta de los DOs— llega a 220.000 GB-s contra 400.000
incluidos. Nunca se paga, siempre que se use la API de hibernación.

**3 · El costo que crece primero es la CPU de Workers**, y adentro de eso, **la
generación de la imagen OG**: ~15 de los 25 segundos de CPU por rifa. Es el 60 %.

> Por eso la URL versionada del OG (`/og/raffle/{id}/{vendidos}.png`) no era sólo
> para arreglar el cache de WhatsApp. Como cada versión es inmutable, se puede
> servir con `max-age=31536000, immutable` y **se genera una sola vez en la vida**.
> Sin eso, esa fila de la tabla se multiplica.

**4 · Si esto llegara a 50.000 rifas/mes, cobrando aunque sea $2 por rifa, son
$100.000 de ingresos contra $73 de infraestructura.** El costo de plataforma
nunca es el problema de este negocio.

## Los tres números a vigilar

| Métrica | Umbral | Qué significa si sube raro |
|---|---|---|
| **DO duration (GB-s)** | 400.000/mes | Algún objeto no está hibernando → revisar `acceptWebSocket` |
| **Workers CPU (ms)** | 30 M/mes | El OG se está regenerando de más → revisar cache headers |
| **D1 rows written** | 50 M/mes | Escrituras al índice más frecuentes de lo previsto |

Dashboard de Cloudflare → **Workers & Pages → rifate-app → Metrics**.

> Y configurá el límite de CPU en `wrangler.jsonc` como red de contención contra
> un bug que consuma de más:
> ```jsonc
> { "limits": { "cpu_ms": 5000 } }
> ```

---

# Ciclo de vida: dos trampas operativas

Dos cosas que no aparecen hasta que ya tenés rifas en producción, y que hay que
diseñar desde el primer día.

## 1 · Migrar el esquema de N objetos

Cada Durable Object tiene **su propia base SQLite**. No existe un `ALTER TABLE`
que alcance a los 500 a la vez: no hay un lugar central desde donde correrlo.

La solución es versionar el esquema dentro del objeto y migrar **cuando
despierta**. SQLite ya trae el contador:

```ts
const VERSION = 3;

export class Raffle extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.migrar());
  }

  private migrar() {
    const sql = this.ctx.storage.sql;
    let v = sql.exec<{ user_version: number }>('PRAGMA user_version').one().user_version;

    if (v < 1) {
      sql.exec(`CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);`);
      sql.exec(`CREATE TABLE numbers (...);`);
      sql.exec(`CREATE TABLE buyers (...);`);
      sql.exec(`CREATE TABLE orders (...);`);
      v = 1;
    }

    if (v < 2) {
      sql.exec(`ALTER TABLE numbers ADD COLUMN note TEXT;`);
      v = 2;
    }

    if (v < 3) {
      sql.exec(`CREATE INDEX orders_pending_idx ON orders (status, created_at DESC);`);
      v = 3;
    }

    sql.exec(`PRAGMA user_version = ${VERSION}`);
  }
}
```

Reglas que hacen que esto funcione a largo plazo:

- **Los bloques `if (v < N)` no se editan nunca.** Se agregan. Un objeto que
  estuvo dormido dos meses tiene que poder recorrer todos los escalones.
- **Migrar sólo hacia adelante.** No hay rollback: no sabés en qué versión está
  cada objeto.
- **`blockConcurrencyWhile` sólo acá**, en el constructor. Nunca por request.
- Un objeto que nadie abre **no migra**, y está bien: migra la próxima vez que
  alguien entre a esa rifa.

> Es el costo real de la arquitectura híbrida. En D1 corrés una migración y
> listo; acá el esquema se propaga de a poco, a medida que las rifas se usan.

## 2 · Storage huérfano

**Un Durable Object factura storage hasta que le vacías los datos.** Borrar la
fila de `raffles` en D1 no borra nada del objeto: el DO sigue existiendo, con su
SQLite lleno, cobrando.

```ts
/** Deja el objeto vacío. Después de esto el sistema lo limpia solo. */
async destroy(userId: string): Promise<void> {
  this.assertOwner(userId);
  await this.ctx.storage.deleteAll();
}
```

Y el flujo de borrado tiene que ser, en este orden:

```ts
export const deleteRaffle = async (env: Env, actor: Actor, raffleId: string) => {
  const raffle = await getOwnedRaffle(env.DB, actor, raffleId);
  if (!raffle) throw new Forbidden();
  if (raffle.sold_count > 0) throw new Error('RAFFLE_HAS_SALES');

  // 1) Primero el DO. Si falla, la rifa sigue en D1 y se puede reintentar.
  await env.RAFFLE.getByName(raffleId).destroy(userIdOf(actor)!);

  // 2) Después el catálogo.
  await env.DB.prepare('DELETE FROM raffles WHERE id = ?').bind(raffleId).run();
};
```

> **El orden importa.** Si borrás primero de D1 y el `destroy()` falla, quedás
> con un objeto que cobra storage y al que ya no tenés forma de llegar desde la
> app: perdiste su id. Al revés, el peor caso es una rifa vacía en el catálogo,
> que se ve y se puede volver a borrar.

Igual que en el diseño Postgres: **una rifa con ventas se cancela, no se borra.**
Borrarla destruye el registro de a quién le corresponde cada número.
