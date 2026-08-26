# Refactor rifate.app — documentación de planificación

> **Estado: arranque de v2.** El código de v1 fue eliminado; el repo queda con
> `docs/` como única herencia.
>
> **La planificación está cerrada.** Todos los documentos reflejan el stack
> final. Las versiones que asumían Supabase quedaron en
> [`_archivo/`](./_archivo/) como registro del análisis.
>
> Próximo paso: [06 · Roadmap](./06-roadmap.md), fase 2.

Punto de partida congelado en el tag **`v1.0.0`** y la rama **`v1-stable`**.
Si algo del refactor se rompe, ese es el punto de retorno.

---

## Orden de lectura

| # | Documento | Qué responde |
|---|-----------|--------------|
| 00 | [Contexto y alcance](./00-contexto-y-alcance.md) | Qué problema resuelve, quiénes lo usan, qué queda afuera |
| 01 | [Stack](./01-stack.md) | Astro vs Next vs TanStack vs Angular. Landing + app juntas |
| 01b | [Infraestructura](./01b-infraestructura.md) | **Vercel vs Cloudflare · Supabase vs D1.** Revisión hecha asumiendo proyecto de cero |
| 02 | [Arquitectura](./02-arquitectura.md) | Capas, carpetas, rutas y por dónde pasa cada request |
| 03 | [Modelo de datos](./03-modelo-de-datos.md) | Reparto D1 / Durable Object, esquema SQLite y sincronización |
| 04 | [Autorización](./04-rls-y-roles.md) | **Lo que reemplaza a RLS:** cinco defensas en TypeScript |
| 05 | [Flujos](./05-flujos.md) | Los recorridos reales: crear, vender, pedir, sortear, canjear |
| 06 | [Roadmap](./06-roadmap.md) | **Las 10 fases, con checkpoint y riesgo por cada una** |
| 07 | [Guía Cloudflare](./07-guia-cloudflare.md) | Cómo configurar Astro + Workers + wrangler, y la imagen OG |
| 08 | [Arranque desde cero](./08-arranque-desde-cero.md) | Qué se rescató de v1, monorepo, deuda de UI |
| 09 | [Durable Objects](./09-durable-objects.md) | Qué son, costos reales, consumo estimado y ciclo de vida |
| 10 | [Better Auth](./10-better-auth.md) | Auth sobre D1: configuración, middleware y gotchas |

[`docs/sql/`](./sql/) — **esquema listo para copiar**: migraciones de D1 y el
esquema versionado del Durable Object. Se lee junto con 03 y 04.

---

## Las decisiones ya tomadas

Estas cinco están cerradas y el resto de los documentos las asume:

1. **Se sigue en Astro.** No se migra el framework. → [01](./01-stack.md)
2. **Cloudflare Workers + D1 + Better Auth.** Decisión final, tomada
   priorizando **aprender el stack** por encima de la eficiencia de
   construcción. El análisis que recomendaba Supabase queda archivado en
   [01b](./01b-infraestructura.md) como registro, no como instrucción.

   Lo que esto implica y hay que asumir de entrada:
   - **No hay RLS.** La autorización vive en TypeScript, con el actor como
     parámetro obligatorio en cada repositorio → [04](./04-rls-y-roles.md)
   - **No hay plpgsql.** Las 9 funciones RPC pasan al Worker; la atomicidad se
     resuelve con `batch()` de D1 o con un Durable Object por rifa
   - **SQLite tiene 5 tipos.** La plata va en `INTEGER` de centavos, nunca en
     `REAL`; los enums son `TEXT` + `CHECK`
   - **Auth se construye.** Better Auth + adapter de D1, en vez de Supabase Auth
3. **Una sola app, sin monorepo.** → [08](./08-arranque-desde-cero.md)
4. **Híbrido D1 + un Durable Object por rifa.** D1 para lo que se consulta
   entre rifas; el DO para la grilla, compradores y pedidos de una. Hace
   imposible la venta doble y da estado en vivo nativo. → [09](./09-durable-objects.md)
5. **El precio es por rifa, no por suscripción.** Cada rifa se crea como BASIC o
   PRO y se paga esa rifa. Los vouchers habilitan rifas gratis. → [03](./03-modelo-de-datos.md)
6. **La numeración es configurable por rifa** (`number_start` 0 o 1), para cubrir
   tanto 00–99 como 1–100. → [03](./03-modelo-de-datos.md)
7. **El pedido del visitante reserva números con vencimiento.** Es el diferencial
   concreto del plan PRO. → [05](./05-flujos.md)

## Lo que queda por decidir

### Producto — sólo vos podés cerrarlas

- [ ] **Precio de BASIC y PRO** en pesos
- [ ] **Duración de la reserva** de un pedido — todo el diseño asume 24 h, y el
      valor aparece en el código del Durable Object
- [ ] **Dominio**: ¿el dashboard comparte `rifate.app` o va en `app.rifate.app`?
- [ ] Pasarela de cobro cuando llegue el momento (Mercado Pago)

### Técnicas — pendientes de documentar

- [ ] **starwind vs shadcn**: elegir antes de portar un solo componente
      → [08](./08-arranque-desde-cero.md)
