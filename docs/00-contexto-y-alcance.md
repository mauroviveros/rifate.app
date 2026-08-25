# 00 · Contexto y alcance

## El problema real

Hoy, una emprendedora o un club que organiza una rifa en Argentina hace esto:

1. Arma una imagen con la grilla de números en alguna app de edición.
2. La sube al estado de WhatsApp o a una historia.
3. Cuando alguien compra un número, **vuelve a editar la imagen** para tachar esa
   celda y la sube de nuevo.
4. En paralelo anota en un cuaderno, en Notas o en un Excel a quién le pertenece
   cada número y su teléfono, para poder avisarle si gana.
5. Al final vuelve a editar otra imagen para revelar el ganador y le manda un
   mensaje.

El resultado: una galería llena de versiones de la misma imagen, un registro
paralelo que se desincroniza de la grilla, y un trabajo manual que crece con
cada venta.

## Qué reemplaza cada parte

| Dolor actual | Reemplazo |
|---|---|
| Editar la imagen en cada venta | La grilla es estado en la base; la imagen se genera sola |
| Subir el estado repetidamente | Un link fijo que siempre muestra el estado actual |
| El cuaderno / Excel paralelo | `raffle_buyers`, atado a los números, sin duplicar |
| Anotar el teléfono para avisar | El teléfono ya está cargado en la venta |
| Editar la imagen del ganador | `draw_raffle_winner()` sortea y la imagen se regenera |
| Ir y venir por WhatsApp por cada número | Plan PRO: el comprador preselecciona y manda un mensaje ya armado |

> El insight que ordena todo el producto: **la imagen no es el registro, es una
> proyección del registro.** En v1 la imagen y los datos eran dos cosas que había
> que mantener sincronizadas a mano. Acá la imagen se deriva del estado, siempre.

## Los tres actores

### 1 · Organizador (`authenticated`)
Tiene cuenta. Crea rifas, carga ventas, confirma pedidos, sortea, comparte el link.
Es quien paga. Es el usuario central del producto.

### 2 · Visitante (`anon`)
**No tiene cuenta y no debería necesitarla nunca.** Entra por un link que le
llegó por WhatsApp. Ve el estado de la rifa en vivo.
- En rifas **BASIC**: sólo mira.
- En rifas **PRO**: preselecciona números y genera un pedido, que le reserva esos
  números un tiempo y le arma el mensaje de WhatsApp al organizador.

> Que el visitante no necesite cuenta no es un detalle de comodidad: es la
> condición para que el producto funcione. Si hay que registrarse para comprar
> un número de rifa de $2.000, no compra nadie.

### 3 · Admin (vos)
`profiles.role = 'ADMIN'`. **No es un rol decorativo**: existe porque alguien
tiene que emitir los vouchers que habilitan rifas gratis (promos, casos
benéficos, early adopters). Sin esa función concreta no valdría la pena tenerlo.

Lo que **no** incluye, para no sobreingenierizar:
- No hay panel de administración separado ni una app aparte.
- No hay sistema de permisos granular: son dos valores en un enum.
- No hay impersonación de usuarios ni auditoría de acciones de admin.

## Los dos tipos de rifa

El precio es **por rifa creada**, no una suscripción mensual. Es lo que encaja
con el uso real: alguien organiza dos rifas al año, no consume una plataforma
todos los meses.

| | BASIC | PRO |
|---|---|---|
| Crear y administrar la rifa | ✅ | ✅ |
| Página pública con estado en vivo | ✅ | ✅ |
| Imagen OG al compartir el link | ✅ | ✅ |
| Imagen descargable de la grilla | ✅ | ✅ |
| Cargar ventas a mano | ✅ | ✅ |
| Sorteo y anuncio del ganador | ✅ | ✅ |
| **Preselección de números por el visitante** | ❌ | ✅ |
| **Pedidos con reserva y bandeja de confirmación** | ❌ | ✅ |
| Máximo de números | 1.000 | 10.000 |

> **Por qué la imagen OG va en los dos planes:** es lo que hace que el link se
> vea bien al compartirlo, y compartir el link es el mecanismo de distribución
> del producto. Ponerla detrás del plan pago frenaría justo lo que hace que la
> app se difunda sola.

## Fuera de alcance en este refactor

- Cobro real (Mercado Pago). El esquema lo prevé (`unlock_method`, `payment_ref`)
  pero no se implementa todavía.
- Notificaciones automáticas por WhatsApp (requiere API oficial y aprobación).
- App móvil nativa.
- Múltiples organizadores por rifa.
- Migrar el hosting a Cloudflare. Analizado en [01](./01-stack.md), pospuesto.
