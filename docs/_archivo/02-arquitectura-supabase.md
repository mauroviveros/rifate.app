# 02 · Arquitectura

> ## ⚠️ SUPERADO POR LA DECISIÓN DE STACK
>
> Se decidió ir a **Cloudflare Workers + D1 + Better Auth**, priorizando el
> aprendizaje del stack por encima de la eficiencia de construcción.
> El principio «la base hace cumplir las reglas» **se invierte**: sin RLS ni plpgsql, toda la autorización y la lógica de escritura pasan a TypeScript. Este documento necesita reescritura.
>
> Ver [README · decisiones](./README.md).

---

## El principio que ordena todo

> **La base de datos es la que hace cumplir las reglas. La app las expresa.**

En v1 las reglas viven en TypeScript: `sellRaffleNumbers` chequea el dueño en la
action, hace dos INSERT separados y, si el segundo falla, borra el comprador a
mano para compensar. Funciona mientras no haya concurrencia y mientras nadie se
olvide de un chequeo.

En v2 esa misma operación es **una función en la base** que valida permisos,
escribe todo dentro de una transacción y no puede dejar estado a medias. La
action de Astro pasa a ser una capa fina: valida el input con Zod, llama a la
función, traduce el error a un mensaje en castellano.

Esto no es purismo. Es la diferencia entre "el número se vendió dos veces y
tenemos dos personas peleando por el mismo premio" y que no pueda pasar.

## Las capas

```
┌──────────────────────────────────────────────────────────┐
│  Páginas .astro          SSR, layout, meta tags          │
│  Islas React             sólo donde hay interacción       │
├──────────────────────────────────────────────────────────┤
│  src/actions/            valida input · traduce errores   │
├──────────────────────────────────────────────────────────┤
│  src/lib/repositories/   ÚNICO lugar con queries          │
│  src/lib/domain/         cálculos puros, sin I/O          │
├──────────────────────────────────────────────────────────┤
│  Supabase                RLS · vistas públicas · RPC      │
│                          ← acá viven las reglas           │
└──────────────────────────────────────────────────────────┘
```

Reglas de la casa:

- **Ninguna página arma su propio `select`.** Todo pasa por `repositories/`.
  v1 ya lo hace bien; hay que sostenerlo.
- **`domain/` no importa Supabase.** Son funciones puras sobre datos ya traídos.
  Es lo único testeable sin base, y es donde va la lógica de negocio de verdad.
- **Las `actions/` no contienen lógica.** Si una action tiene un `if` de negocio,
  ese `if` está en el lugar equivocado.

## Estructura de carpetas propuesta

Lo que cambia respecto de v1 va marcado. El resto se mantiene.

```
src/
├── actions/
│   ├── index.ts
│   ├── raffle/
│   │   ├── create.ts              ← createRaffle
│   │   ├── publish.ts             △ nuevo: DRAFT → PUBLISHED
│   │   ├── sell.ts                ← sellRaffleNumbers, ahora vía RPC
│   │   ├── release.ts             △ nuevo: liberar números
│   │   └── draw.ts                △ nuevo: sortear ganador
│   ├── order/
│   │   ├── create.ts              △ nuevo: pedido del visitante (PRO)
│   │   ├── confirm.ts             △ nuevo
│   │   └── cancel.ts              △ nuevo
│   └── voucher/
│       ├── redeem.ts              △ nuevo
│       └── issue.ts               △ nuevo: sólo admin
│
├── lib/
│   ├── domain/raffle.ts           ~ ampliar: padding de números, rangos
│   ├── repositories/
│   │   ├── raffle.ts              ~ reescribir contra vistas + RPC
│   │   ├── order.ts               △ nuevo
│   │   └── voucher.ts             △ nuevo
│   ├── og/template.ts             △ nuevo: layout satori de la imagen social
│   ├── og/render.ts               △ nuevo: satori → SVG → PNG con resvg-wasm
│   ├── og/fonts.ts                △ nuevo: Nunito en base64 (generado)
│   ├── supabase/
│   │   ├── server.ts              ~ acepta el env de runtime de Workers
│   │   └── errors.ts              △ nuevo: código PG → mensaje en castellano
│   ├── whatsapp/index.ts          ~ ampliar: mensaje de pedido
│   └── formatters/index.ts        ~ ampliar: formato de número con padding
│
├── pages/
│   ├── index.astro                = landing, prerender
│   ├── r/[slug].astro             △ pública, reemplaza /raffle/[id]
│   ├── r/[slug]/pedido.astro      △ estado del pedido por token
│   ├── dashboard/
│   │   ├── raffle/index.astro     = listado
│   │   ├── raffle/create.astro    = alta
│   │   └── raffle/[id].astro      ~ + pestaña de pedidos + sorteo
│   ├── admin/vouchers.astro       △ nuevo, sólo ADMIN
│   └── og/raffle/[id]/[v].png.ts  ~ satori + resvg-wasm, URL versionada (ver 07)
│
└── components/ui/                 ⚠ unificar shadcn vs starwind
```

Leyenda: `=` sin cambios · `~` se modifica · `△` nuevo · `⚠` deuda a resolver

## La deuda de UI que hay que saldar

`src/components/ui/` tiene **dos librerías completas en paralelo**:

```
ui/shadcn/    button card dialog field input label progress separator textarea   (React)
ui/starwind/  button card dialog input label progress textarea + avatar dropdown
              input-group skeleton                                        (Astro)
```

Siete componentes están duplicados. Hoy eso significa que un cambio de estilo en
el botón hay que hacerlo dos veces, y que el botón de la landing y el del diálogo
de venta pueden divergir sin que nadie se entere.

**Recomendación:** starwind como base (es Astro, es lo que más se usa, no manda
JS) y shadcn sólo para los componentes que viven dentro de una isla React y
necesitan estado. Que quede escrito cuál es cuál, y que no haya un `Button` en
las dos.

Esto **no** es parte del refactor de datos. Es una fase aparte para no mezclar.

## Rutas: qué cambia

| v1 | v2 | Por qué |
|---|---|---|
| `/raffle/[uuid]` | `/r/[slug]` | Un uuid en un estado de WhatsApp es ilegible. `rifate.app/r/rifa-del-club-2026` se lee, se dicta por teléfono y se comparte |
| — | `/r/[slug]/pedido?t=<token>` | El visitante vuelve a ver su pedido sin cuenta |
| — | `/admin/vouchers` | Emisión de vouchers |
| `/dashboard/raffle/[id]` | igual | El dashboard sigue con uuid: es privado y no se comparte |

> **Compatibilidad:** las rifas de v1 ya compartidas por WhatsApp tienen links
> `/raffle/<uuid>` circulando en chats. Esos links tienen que seguir andando.
> Ver [06 · Roadmap](./06-roadmap.md), fase 4: se deja un redirect permanente de
> `/raffle/[id]` a `/r/[slug]`.

## Cacheo de la página pública

Es la ruta con más tráfico y la que más importa que abra rápido. Pero muestra
estado que cambia.

Propuesta: `Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=300`

En Cloudflare Workers esto lo respeta el CDN sin configuración extra.

Traducido: el CDN sirve la respuesta cacheada hasta 30 segundos y, mientras
revalida, sigue sirviendo la vieja hasta 5 minutos. Si la rifa se comparte en un
grupo y entran 200 personas en un minuto, la base recibe ~2 queries en lugar de
200.

30 segundos de desfase en la grilla es aceptable: el número lo confirma el
organizador por WhatsApp igual, y la reserva del plan PRO se valida contra la
base en el momento del pedido, no contra lo que muestra la página.
