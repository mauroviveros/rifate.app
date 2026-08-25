# 01b · Infraestructura: dónde corre y dónde vive la data

> ## ⚠️ SUPERADO POR LA DECISIÓN DE STACK
>
> Se decidió ir a **Cloudflare Workers + D1 + Better Auth**, priorizando el
> aprendizaje del stack por encima de la eficiencia de construcción.
> Este documento recomendaba Vercel + Supabase. La recomendación queda como registro del análisis, no como instrucción.
>
> Ver [README · decisiones](./README.md).

---

> Revisión hecha asumiendo **proyecto de cero**. El costo de migrar sale de la
> ecuación, y con él uno de los dos argumentos que sostenían la recomendación
> original. Quedan cinco ejes: tiempo de construcción, costo, performance,
> superficie operativa y garantías de corrección.

## Resumen ejecutivo

**Recomendación final: Astro + Vercel + Supabase ahora; Cloudflare cuando cobres.**

> **Corregido tras verificar dos límites.** (1) Browser Run permite *1 request
> cada 10 segundos* en Free y es desproporcionado para una tarjeta estática, así
> que dejó de ser una ventaja de Cloudflare — el OG se hace con satori en las dos
> plataformas. (2) Workers Free da **10 ms de CPU** y la doc de Cloudflare dice
> que SSR usa 10-20 ms: no alcanza. Resultado: hoy Vercel Hobby es $0 y
> Cloudflare son $5. La ventaja de costo aparece recién cuando cobres, porque ahí
> Vercel Pro ($20) pasa a ser obligatorio.

**Recomendación original (superada): Workers + Supabase.**

El razonamiento corto: el argumento técnico fuerte a favor de D1 era tener la
data cerca del usuario. **Para Argentina eso no se cumple** — D1 no tiene región
de réplica en Sudamérica. Sin ese beneficio, D1 queda ofreciendo "un solo
proveedor" y "más barato" a cambio de rehacer Auth y perder las garantías de
Postgres. El hosting en Cloudflare, en cambio, se paga solo.

---

## Los dos datos que cambiaron la conclusión

### 1 · A favor de Cloudflare: el OG está resuelto, y mejor

Cloudflare **Browser Run** tiene un endpoint `/screenshot` que acepta HTML crudo
y devuelve la imagen. Binding directo desde el Worker, sin API token, **incluido
en el plan free**.

Esto no es "portar lo que ya tenés": es borrarlo. Se van `satori`, `@resvg/resvg-js`
y los dos `.ttf` de 39 KB cada uno, y la imagen pasa a escribirse en HTML y CSS
normal — grid real, fuentes web, gradientes — en lugar del subset limitado que
soporta satori.

Mi objeción original ("`@resvg/resvg-js` no corre en Workers") era cierta pero
irrelevante: la solución es mejor que el punto de partida.

### 2 · En contra de D1: no hay réplica en Sudamérica

D1 replica automáticamente y sin costo extra, pero sólo en estas regiones:

```
ENAM · WNAM · WEUR · EEUR · APAC · OC
```

**No hay región sudamericana.** Un usuario en Buenos Aires con un Worker en el
PoP de Buenos Aires termina consultando una réplica en Norteamérica: ~120–150 ms
por query.

Supabase, en cambio, tiene región en **São Paulo**: ~30–40 ms desde Argentina.

Esto invierte el argumento de performance que estaba por hacer a favor de D1. La
promesa de "data en el edge" no se materializa para este mercado.

---

## Performance: el análisis honesto

La conclusión importante es que **el eje de performance está casi empatado, y no
lo decide la base de datos.**

La página que importa es `/r/[slug]`: se comparte en un grupo de WhatsApp y la
abren 200 personas en un minuto. En **cualquiera** de las dos plataformas, la
respuesta correcta es cachear el HTML renderizado en el CDN unos 30 segundos.
Con eso, el 95 % de esos 200 requests nunca llega a la base y la latencia de la
base deja de importar.

Lo que sí queda como diferencia real:

| | Vercel (serverless) | Cloudflare Workers |
|---|---|---|
| Cold start | ~300–800 ms para una función Node | Prácticamente nulo |
| Región de cómputo | Fija (gru1 = São Paulo) | El PoP más cercano |

El cold start **sí importa acá**, y es específico de este producto: un link de
rifa queda en un chat y alguien lo toca seis horas después, cuando la función
está fría. Ese es el peor caso y es también el caso más común. Workers no tiene
ese problema.

> **Conclusión del eje:** Cloudflare gana en cómputo (cold start), Supabase gana
> en cercanía de datos (São Paulo vs Norteamérica). La combinación
> **Workers + Supabase** se queda con las dos.

---

## Costo

| | Free | Pago |
|---|---|---|
| **Cloudflare Workers** | 100 k req/día | $5/mes |
| **D1** | 5 M filas leídas/día · 100 k escritas/día · 5 GB | Incluido en los $5 |
| **Vercel** | Hobby | **Pro $20/mes** |
| **Supabase** | 500 MB, pausa proyectos inactivos | Pro $25/mes |

Dos observaciones concretas:

> **El plan Hobby de Vercel es para proyectos personales no comerciales.** Si vas
> a cobrar por rifa, necesitás Pro: **$20/mes desde el día uno**, con cero
> ingresos. Cloudflare no tiene esa restricción. Este solo dato ya justifica
> mover el hosting.

> **Supabase free pausa proyectos inactivos.** Antes de tener usuarios lo vas a
> chocar seguido y es molesto en desarrollo. Cloudflare no pausa nada.

Sobre los límites de escritura de D1, un detalle que importa por el diseño del
esquema: materializar la grilla cuesta **una escritura por número**. Una rifa de
1.000 números son 1.000 filas escritas, más las de los índices. Con 100 k
escrituras/día en el free tier, eso son ~50–80 rifas nuevas por día. Suficiente,
pero es un límite que en Postgres no existe.

---

## Tiempo de construcción

Es el eje donde la diferencia es más grande y menos discutible.

| Pieza | Supabase | D1 |
|---|---|---|
| Auth con Google | **0 días** — ya funciona | 2–3 días (Better Auth + adapter) |
| Esquema | 2 días (ya escrito) | 2 días (reescribir a SQLite) |
| Lógica de negocio | En la base (ya escrita) | +3–4 días: las 9 RPC pasan a TypeScript |
| Autorización | RLS declarativo | Capa de aplicación con disciplina de tipos |

Delta neto: **alrededor de una semana**. Sobre un proyecto de varias semanas no
es determinante, pero tampoco es gratis.

El punto que pesa no es la cantidad de días sino *cuáles*: **Auth es lo de mayor
consecuencia si sale mal** en una app que guarda teléfonos de personas que se los
dieron a la vecina que les vendió el número, no a una plataforma. Better Auth es
software serio y bien probado, pero pasás a ser dueño del manejo de sesiones, los
flags de las cookies, la validación del callback de OAuth y el CSRF.

---

## Garantías de corrección

Acá Postgres gana claramente, y conviene ser específico en vez de decir "es más
robusto".

| | Postgres | SQLite / D1 |
|---|---|---|
| Tipos | `numeric` exacto, enums, arrays, `timestamptz` | 5 tipos: TEXT, INTEGER, REAL, BLOB, NULL |
| Dinero | `numeric(12,2)` | **`REAL` es un bug**: hay que usar INTEGER de centavos |
| Enums | Nativos | `TEXT` + `CHECK` |
| Autorización | RLS, declarativa, en la base | En el código |
| Lógica de servidor | plpgsql | No hay: todo en el Worker |

Sobre atomicidad **me corrijo respecto de lo que dije antes**: el `batch()` de D1
**sí es una transacción SQL real con rollback**. Lo que no podés es ramificar en
medio de la transacción (leer, decidir en JavaScript, escribir). Para la reserva
de números hace falta un statement guarda que aborte a propósito:

```sql
-- Tabla que sólo existe para fallar cuando la condición se cumple.
CREATE TABLE _abort (id INTEGER PRIMARY KEY CHECK (id = -1));

-- Dentro del mismo batch(), después del UPDATE de reserva:
-- si no se reservaron todos los números pedidos, este INSERT viola el CHECK,
-- tira error y aborta el batch entero.
INSERT INTO _abort (id)
SELECT 1 WHERE (
  SELECT COUNT(*) FROM raffle_numbers WHERE order_id = ?1
) <> ?2;
```

Funciona y es determinista. Pero es exactamente el tipo de truco que en Postgres
no hace falta, y que dentro de seis meses nadie recuerda por qué está.

> Un detalle del esquema que ya diseñé y que en D1 habría que cambiar: la
> documentación de D1 desaconseja explícitamente `ORDER BY RANDOM()`, que es lo
> que usa `draw_raffle_winner()` para sortear.

---

## Qué compensa la falta de RLS

Si igual vas por D1, la contraparte que exigiría — y que da la mayor parte de la
garantía sin motor — es **hacer imposible construir un query sin declarar quién
lo pide**:

```ts
// El actor no es opcional y no tiene default. Si te olvidás, no compila.
type Actor =
  | { kind: 'visitor' }
  | { kind: 'organizer'; userId: string }
  | { kind: 'admin'; userId: string };

// Cada repositorio recibe el actor y decide. No hay forma de saltearlo
// porque no existe una función que consulte sin él.
export const getRaffleForActor = async (
  db: D1Database,
  actor: Actor,
  raffleId: string,
): Promise<RaffleView | null> => { /* … */ };
```

La diferencia con RLS es real y vale nombrarla: RLS te protege del bug que
**todavía no escribiste**. Esta disciplina te protege del que ya sabés que podés
cometer. Es peor, pero no es poco — y es cómo funciona la mayoría del software
que usás todos los días.

---

## Las tres opciones, lado a lado

| | A · Vercel + Supabase | **B · Workers + Supabase** | C · Workers + D1 |
|---|:--:|:--:|:--:|
| Costo mes 1 (cobrando) | $20 | **$0–5** | **$0–5** |
| Cold start | ~500 ms | **~0** | **~0** |
| Latencia de datos (AR) | **~5 ms** ᵃ | ~30 ms | ~120 ms ᵇ |
| Auth | **Listo** | **Listo** | Rehacer |
| RLS | **Sí** | **Sí** | No |
| Tipos ricos | **Sí** | **Sí** | No |
| Proveedores | 2 | 2 | **1** |
| Se pausa por inactividad | Sí | Sí | **No** |
| Semanas hasta v2 | **~2** | **~2** | ~3 |

ᵃ función y base co-locadas en São Paulo · ᵇ réplica en Norteamérica

## Recomendación

**Opción B: Astro + Cloudflare Workers + Supabase.**

Te lleva a Cloudflare, que es lo que buscabas, y el traslado se paga solo:
eliminás los $20/mes de Vercel Pro, eliminás el cold start del peor caso de uso
del producto, y el generador de OG queda más simple del que tenés.

Y conservás lo que de verdad cuesta reponer: Google OAuth funcionando, RLS como
segunda línea, `numeric` para la plata, enums reales, y toda la lógica que ya
está escrita en `docs/sql/`.

**La opción C no es mala** — es defendible y no me opondría si la elegís. Pero el
argumento técnico que la justificaba era tener los datos en el edge, y para
Argentina ese beneficio no existe hoy. Lo que queda es "un proveedor" y "más
barato" contra "rehacer Auth" y "menos garantías". A mi juicio no cierra.

> **Si el objetivo incluye aprender Cloudflare a fondo**, C es el camino y es una
> razón legítima — sólo que es una razón de aprendizaje, no de eficiencia, y
> conviene tenerlo explícito al decidir.

## Durable Objects: por qué siguen sobre la mesa

Independientemente de dónde viva la base, hay una pieza de Cloudflare que encaja
muy bien con **este** producto en particular.

Los datos de esta app están **perfectamente particionados por rifa**: salvo
"listar mis rifas", toda consulta y toda escritura pertenece a una sola rifa. Eso
es exactamente la forma de un Durable Object.

Un DO por rifa te daría:

- **Serialización de escrituras.** La venta doble del mismo número deja de ser un
  problema a resolver con cuidado y pasa a ser imposible por construcción. No hay
  que razonar sobre locks de fila ni predicados en el UPDATE.
- **Estado en vivo real.** WebSocket con hibernación: la grilla se actualiza sola
  en la pantalla de todos los que están mirando, sin polling y sin sumar Supabase
  Realtime.

El costo es la coordinación: un DO no puede responder "listame todas mis rifas",
así que hace falta un índice aparte que el DO actualiza al escribir — dos fuentes
para los datos de resumen.

**Recomendación sobre esto:** no lo tomes ahora. Primero que funcione con
Workers + Supabase. Si el "estado en vivo" resulta ser el diferencial que
realmente vende el plan PRO, ahí un DO por rifa es la mejor herramienta que
existe para el problema — y se puede sumar sin rehacer el resto.

---

## Qué implica para lo ya documentado

Si vas por **B** (recomendada):

| Documento | Estado |
|---|---|
| 00 · Contexto | Sin cambios |
| 01 · Stack | Reescribir la sección de Cloudflare |
| 02 · Arquitectura | Cambia el adapter y el generador de OG |
| 03 · Modelo de datos | **Sin cambios** |
| 04 · RLS | **Sin cambios** |
| 05 · Flujos | Sin cambios |
| 06 · Roadmap | Sumar la fase de adapter, adelantada |
| `docs/sql/` | **Sin cambios: los 8 archivos siguen valiendo** |

Si vas por **C**, se reescriben 02, 03 y 04 completos, los 8 archivos SQL se
rehacen en SQLite, y se suma un documento de Auth.
