# 11 · Sistema visual · «Talonario»

> **Fuente de verdad:** el canvas de diseño
> https://claude.ai/code/artifact/1bdf7efc-d964-474b-b233-fc130f3b5466
>
> Este documento es la copia versionada de lo que hay que respetar al construir.
> Si el canvas cambia, gana el canvas — y este archivo se actualiza.

## La idea

Marca nueva para rifate.app. **El punto de partida es el talonario de rifa de
papel**, llevado a un lenguaje plano y contemporáneo.

> «Todo está calibrado para leerse rápido y sin anteojos.»

Eso no es decoración: la usuaria es una emprendedora o una señora del club
vendiendo números por WhatsApp desde un celular, muchas veces al sol.

## Tokens

### Color

| Token | Hex | Uso |
|---|---|---|
| **Tinta** | `#17181C` | Texto, encabezados, número elegido |
| **Papel** | `#F5EEE0` | Fondo de toda la app |
| **Papel claro** | `#FFFCF6` | Tarjetas y campos |
| **Vermellón** | `#CE3418` | **Una sola acción principal por pantalla** |
| **Verde** | `#1B6E45` | Progreso, vendido, confirmaciones |
| **Amarillo** | `#F5C544` | Bloques de énfasis y etiquetas |

Grises de apoyo: `#4A4C55` (texto secundario), `#6B6D76` (**el más claro
permitido**), `#E4DAC6` / `#D8CDB6` (bordes), `#EAE2D1` (vendido).

Dos colores más, que estaban en los artboards pero no en esta tabla:

| Token | Hex | Uso |
|---|---|---|
| **Sombra vermellón** | `#8F2410` | El sello del botón principal, y sólo eso |
| **Gris deshabilitado** | `#8A857A` | El texto de un botón apagado |

El fondo lleva una trama de puntos: `radial-gradient(#E7DECA 1.1px, transparent
1.1px)` a `16px 16px`.

### Tipografía

| Familia | Para qué | Clase |
|---|---|---|
| **Bricolage Grotesque** (700, 800) | Sólo títulos y cifras grandes. `letter-spacing: -0.025em` | `font-display` |
| **Figtree** (400–900) | Todo el texto corrido y la interfaz | `font-sans` (el default) |
| la del sistema | Códigos e IDs: el `A3F91C` de un pedido | `font-mono` |
| — | **`font-serif` no existe.** Bricolage es una grotesca, no una serif, y mapearla ahí sería mentir en el token: se borra con `--font-serif: initial` | — |

Las variables `--font-bricolage` y `--font-figtree` **no se declaran en el tema**:
las define el componente `<Font>` de Astro en `:root`. Declararlas dos veces lo
resuelve el orden de carga, y eso no falla con un error — falla con la fuente
equivocada de vez en cuando.

```
Display  46px   "Mis rifas"
Título   28px   "Elegí tus números"
Cuerpo   18px   "Tocá los que quieras."     ← base, nunca menos de 15px
Apoyo    16px   "Podés elegir varios."
Etiqueta 15px   "Sortea el 20 sep"
```

**Los números siempre con `font-variant-numeric: tabular-nums`.**

### Formas

```css
.card  { background: #FFFCF6; border: 2px solid #E4DAC6; border-radius: 20px; padding: 26px; }
.cell  { width: 60px; height: 60px; border-radius: 14px; border: 2px solid transparent; }
```

Botones: **altura mínima 56px** — pero en el artboard `Sistema` están todos
dibujados a **60px con radio 16**. El 56 es el piso, no la medida corriente.
Campos: **altura 60px**, radio 15.

### El sello

```css
box-shadow: 0 5px 0 0 <sombra>;   /* sin blur, sin spread */
```

El borde inferior grueso que hace que la cosa parezca una tecla. **Lo lleva
sólo la acción principal**: la secundaria y la terciaria van planas. Es lo que
separa la única acción principal de la pantalla (regla 2) sin depender del
color, que es la regla 8 aplicada a los botones.

La sombra es siempre la versión **oscura de la propia superficie**:

| Superficie | Sombra |
|---|---|
| Vermellón `#CE3418` | `#8F2410` |
| Papel o blanco | Tinta `#17181C` |
| Tinta `#17181C` (celda elegida) | Vermellón `#CE3418` |

### Las cuatro acciones

Del artboard `Sistema`. Ojo que **la secundaria no es la de borde**:

| | Superficie | Sello |
|---|---|---|
| **Principal** | vermellón | sí |
| **Secundaria** | tinta llena | no |
| **Terciaria** | borde 2px de tinta, peso 700 | no |
| **Deshabilitada** | `#E4DAC6` con texto `#8A857A` | no |

El deshabilitado es una superficie **diseñada**, no una opacidad: con la regla 7
el botón apagado explica el motivo en su etiqueta, así que tiene que leerse.

### El troquelado

```css
background-image: repeating-linear-gradient(90deg, #D8CDB6 0 5px, transparent 5px 11px);
height: 2px;
```

Aparece 17 veces en los artboards (13 horizontal, 4 vertical): es la línea por
donde se corta el talón, y es un componente del sistema.

### La hoja de atrás

La tarjeta protagonista de una pantalla lleva un pliego `#E7DECA` desplazado
detrás (`inset: 14px -12px -12px 12px`) más una sombra suave. El talonario es
un **bloc**, no una hoja suelta.

### Los tres estados del número

```css
.free   { background: #FFFCF6; border-color: #D8CDB6; color: #17181C; }

.picked { background: #17181C; border-color: #17181C; color: #F5EEE0;
          box-shadow: 0 5px 0 0 #CE3418; }          /* el "sello" vermellón */

.sold   { background: #EAE2D1; border-color: #E0D7C4; color: #A7A192;
          /* tachado en diagonal, dibujado con gradiente */
          background-image: linear-gradient(to top right,
            transparent calc(50% - 1.4px), #BEB5A2 calc(50% - 1.4px),
            #BEB5A2 calc(50% + 1.4px), transparent calc(50% + 1.4px)); }
```

> El tachado diagonal del número vendido **es el gesto de la rifa de papel**.
> Es lo que la app viene a automatizar, convertido en su propio lenguaje visual.

---

## Las nueve reglas

Del artboard «Sistema visual». Son de producto, no de estética:

1. **En el celular la grilla va a 5 columnas, no a 10.** Cada número mide 64px
   en vez de 35px.
2. **Una sola acción principal por pantalla**, siempre en vermellón y siempre
   visible sin buscar.
3. **La barra de compra queda fija abajo**, con la cuenta y el total a la vista.
   No hay que volver a subir.
4. **Se habla como en el barrio:** «Tocá los que quieras», no «Seleccione los
   números deseados».
5. **Los pasos van numerados 1-2-3** en la página pública, para que nadie se
   pregunte qué sigue.
6. **Nada de gris finito:** el texto más claro permitido es `#6B6D76` y el
   cuerpo arranca en 18px.
7. **Un botón apagado explica el motivo** en su propia etiqueta: «Elegí un
   número primero».
8. **Ningún estado depende sólo del color:** forma, tachado y texto acompañan
   siempre.
9. Botones ≥56px, campos 60px.

---

## Las pantallas

Dieciséis artboards, agrupados:

### Lo que ve el comprador
| Artboard | Pantalla |
|---|---|
| `Main` | Rifa pública · celular ← **la pantalla más importante del producto** |
| `PublicDesktop` | Rifa pública · escritorio |
| `Landing` / `LandingMobile` | Inicio |
| `NotFound` | Página no encontrada |

### Panel del organizador
| Artboard | Pantalla |
|---|---|
| `Dashboard` / `DashboardMobile` | Mis rifas |
| `Create` | Crear rifa |
| `Detail` | Detalle y venta |
| `Login` | Ingresar |

### Imagen para compartir
Cuatro propuestas de OG, **1200×630**, para elegir una:

| Artboard | Concepto | Fondo |
|---|---|---|
| `OgTalonario` | A · Talonario | `#17181C` tinta |
| `OgGrilla` | B · Grilla | `#F5EEE0` papel |
| `OgUrgencia` | C · Cuántos quedan | `#CE3418` vermellón |
| `OgMinimo` | D · Mínimo | `#F5C544` amarillo |

Contenido de referencia (de `OgTalonario`):

```
rifate.app
RIFA SOLIDARIA
Rifa del Club Estrella
Bici rodado 29 + canasta de asado para diez personas.
Cada número $2.500 · Quedan libres 73 de 100 · Se sortea 20 sep
```

> **Falta decidir cuál.** Ver [pendientes](#lo-que-esto-cambia).

---

## Lo que esto cambia

Tres cosas que ya estaban escritas y **quedan desactualizadas**:

### 1 · La plantilla OG de la guía es de otro diseño

En [07 · etapa C](./07-guia-cloudflare.md) escribí una plantilla con gradiente
verde y tipografía Nunito. **Nada de eso es la marca.** Hay que rehacerla sobre
el artboard elegido, con Bricolage Grotesque + Figtree y la paleta de acá.

- [ ] Elegir entre `OgTalonario`, `OgGrilla`, `OgUrgencia` y `OgMinimo`
- [ ] Reescribir `src/lib/og/template.ts` sobre ese artboard
- [ ] Cambiar las fuentes embebidas: **Bricolage Grotesque + Figtree**, no Nunito

> Ojo con satori: soporta **sólo flexbox**. El `background-image` con
> `linear-gradient` del tachado y la trama de puntos del fondo pueden no
> renderizar. Hay que verificarlo temprano — el tachado es el gesto central de
> la marca, y si satori no lo dibuja, se resuelve con un pseudo-elemento rotado
> o se reconsidera el motor para el OG.

### 2 · La deuda de UI se resuelve sola

En [02](./02-arquitectura.md) y [08](./08-arranque-desde-cero.md) quedaba abierto
**starwind vs shadcn**. Con un sistema visual propio —tipografías específicas,
radios de 14/20px, alturas de 56/60px, tres estados de celda hechos a medida— la
pregunta cambia: no se adopta una librería y se la pelea, **se escriben los
componentes contra estos tokens**.

- [x] **Cerrado (fase 6).** La pregunta estaba mal planteada: no era qué
      librería, era **qué contrato de nombres**. Ver abajo.

#### Lo que en realidad decide: el contrato, no la librería

Los componentes de starwind **y** los de shadcn están escritos, literal, contra
`bg-primary`, `border-border`, `bg-card` y la escala `--radius`. Si el
stylesheet no define esos nombres, no se puede portar nada nunca — y elegir
librería queda decidido por la ventana.

Por eso el reparto de hojas es:

```
src/styles/starwind.css   lo escribe `starwind init` — y SÓLO `init`.
                          Es el entry de Tailwind y define el CONTRATO:
                          @theme inline { --color-primary: var(--primary) } + :root neutro.
                          NO SE TOCA. Está en .prettierignore y en los ignores de eslint.

src/styles/global.css     nuestro. Importa el anterior y pisa los valores crudos
                          (--primary, --background, …) con Talonario, más los
                          alias de marca y las utilidades de la grilla.
```

Ese doble salto `--color-primary → --primary` parecía indirección de más al no
haber modo oscuro. **Tiene otro pagador, pero no el que estaba escrito acá.**

Lo que decía antes —que `starwind update` reescribe la hoja— es falso: `update`
refresca *component source*, no el CSS. El único comando que toca
`starwind.css` es `init`, que se corre una vez.

El pagador real es que **los componentes del CLI leen las variables crudas
adentro de clases arbitrarias**. El hover de `secondary` en `button/variants.ts`
era, literal, `hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]`.
Si pisás `--color-secondary` en vez de `--secondary`, esa clase se sigue
comiendo el `neutral-200` de starwind y el botón salta a gris. Por eso el
override va en `:root` sobre los valores crudos, que es además el flujo de
tokens que documenta el propio starwind.

> El costo de mantener las dos hojas es el `:root`/`.dark` neutro de starwind,
> que se emite igual aunque esté íntegramente pisado: **1,5 KB** y 20 variables
> de paleta sin uso. Medido sobre el build, no estimado. Alcanza para no
> justificar colapsar los archivos.

Un solo `@import "tailwindcss"` en todo el proyecto, y vive en el archivo del
CLI. En v1 había **tres** hojas con tres imports y dos layouts cargaban
distintas: esa era la deuda real detrás de los «siete componentes duplicados»
de [02](./02-arquitectura.md).

#### La regla de las tres puertas

Un componente **se escribe a mano** salvo que pase las tres:

1. **¿Administra foco o `aria-*` que cambia con la interacción?** Focus trap,
   roving tabindex, `aria-expanded`, devolver el foco al cerrar. Si no —un
   botón, una tarjeta, un input, una etiqueta— se escribe: son veinte líneas y
   salen exactos a estos tokens.
2. **Si sí, se instala con el CLI**, nunca se copia de v1:
   `npx starwind@latest add <componente>`. La copia de v1 está congelada y no
   tiene `starwind update`; además starwind 3.x apoya la accesibilidad en
   `@starwind-ui/astro`, un paquete que se actualiza por npm. Un componente
   copiado a mano no recibe nunca un arreglo de accesibilidad.
3. **shadcn sólo adentro de una isla de React**, que es el único lugar donde
   starwind no llega: un `.astro` no entra en un árbol de React. Hoy no hay
   ninguna isla, así que shadcn no se usa. El primer candidato real es la
   grilla en vivo de la fase 8.

> **En v1 la duplicación fue obligada, no un descuido.** `@starwind/*` se
> importaba sólo desde `.astro` y `@shadcn/*` sólo desde `.tsx`; cuando «crear
> rifa» y «detalle» pasaron a ser islas `client:only`, hubo que tener un gemelo
> React de Button, Card e Input. La duplicación fue el síntoma; la causa fue la
> isla. No se previene eligiendo una librería, se previene **no creando islas
> de más**.

> **Los diálogos del detalle pasan por esta regla, y del lado correcto.**
> «Sortear» y «anular» (fase 9) son modales de verdad: foco atrapado,
> `aria-modal`, `Escape`, foco de vuelta al cerrar. Eso es la puerta 1 → se
> instalan con `npx starwind@latest add dialog`, no se escriben a mano ni se
> fingen con `:target`. «Editar» **no** es un modal: son cinco campos con
> ayuda, así que es una página (`/panel/rifa/[id]/editar`), igual que «crear».
>
> Que el panel cargue este JS **no contradice** el «sin JavaScript» de la
> fase 6: esa decisión es sólo sobre **la grilla del detalle** —un muro de
> `<input type=checkbox>` atados al panel por `form=`, que la fase 8 va a
> actualizar por `[data-n]` desde el WebSocket—. El panel ya trae un script
> mínimo (contadores y etiquetas). Lo que sí se mantiene lo más estático
> posible es `/r/[slug]`: es la que se comparte, vive detrás del cache de CDN
> y cada visita no cacheada despierta el DO.

#### Cómo se porta

- Lo del CLI **no se reformatea** ni se le corrigen cosas de estilo al voleo.
  Pero **sí se le editan los `variants.ts`**, y es el camino que documenta
  starwind para una variante reutilizable. La red es
  `starwind update <componente> --diff <path>`, que muestra el diff planeado
  archivo por archivo antes de aceptar nada.

  La alternativa —pasar la forma de Talonario por `class` en cada llamada— es
  peor y además **no funciona**: `tailwind-variants` mergea con `tailwind-merge`,
  que sólo conoce la escala de fábrica. `text-title` no le pisa al `text-xl` del
  componente (quedan los dos, y gana el que la hoja emita último) y `text-support`
  cae en el grupo de COLOR, donde se come al `text-muted-foreground`. Por eso
  los `variants.ts` importan `tv` de `@/lib/tv`, que es un `createTV` con las
  claves propias declaradas. Si agregás un `--text-*` o `--spacing-*` a
  `global.css`, va también ahí.
- Si un componente pide un token que no tenemos (`--info`, `--outline`), se le
  da un **valor diseñado**, no un placeholder. Talonario no tiene azul: un
  aviso informativo es texto sobre papel, y eso es una decisión, no un relleno.
- Lo vendorizado vive en `src/components/starwind/` y lo propio en
  `src/components/`, salvo lo que **sólo arma un layout** —el header del panel y
  el menú de la cuenta—, que vive en `src/layouts/components/`. Que se vea de un
  vistazo qué es nuestro, qué es de otro, y qué no tiene sentido fuera de su
  layout: `Brand` lo usan el login y el panel, así que es de todos; `Header` y
  `User` no se pueden llamar desde una página sin el layout puesto.

  La regla para decidir es la misma de siempre: **si dos pantallas que no
  comparten layout lo van a usar, es de `src/components/`.**

### 3 · El nombre

Los artboards hablan de **«Talonario»** como nombre del sistema visual. Conviene
que quede claro si es el nombre del design system dentro de rifate.app, o si el
producto pasa a llamarse así.

---

### 4 · El logotipo dice la dirección, no el nombre

En los nueve artboards de pantalla la palabra es **`rifate`** a secas, y el
`rifate.app` completo aparece sólo en las cuatro OG. **Acá le ganamos al canvas
a propósito:** el logotipo dice siempre la dirección.

- Quien abre `/r/club-estrella` llegó de un WhatsApp. Nunca eligió venir, y el
  logotipo es el único lugar de la pantalla que le dice a qué sitio entró. Es el
  mismo motivo por el que el canvas ya lo escribe completo en la OG — sólo que
  ese motivo no se termina en la imagen del preview.
- `rifate` solo es un verbo en voseo; `rifate.app` es un nombre.
- Una marca con dos formas obliga a decidir cuál va cada vez, y esa decisión se
  toma mal a las seis de la tarde.

Medido antes de decidirlo, no después: en la barra del celular la palabra pasa
de 52 a 93px, y de los 375 quedan 254 ocupados. Entra con aire.

El `.app` va en **vermellón, en las dos superficies.** Las cuatro OG escriben la
palabra en un solo color, así que esto también le gana al canvas.

Lo que se descartó y por qué: que el `.app` siguiera **al color de la caja del
ticket** suena razonable hasta que se mira sobre papel, donde la caja es tinta y
la palabra también — el acento se anula justo en la superficie donde mejor se ve
(4.41:1) y sobrevive sólo en la barra oscura, que es donde peor contrasta.

| | contraste | |
|---|---|---|
| vermellón sobre papel | 4.41:1 | cómodo |
| vermellón sobre tinta | **3.49:1** | alcanza **porque es texto grande** |

Los 3.49 pasan AA por los pelos, y por una razón que hay que tener presente: el
logotipo es de 20 y 22px en peso 800, arriba del piso de 18.66px en negrita que
AA considera texto grande. **Si el logotipo alguna vez se achica, este acento es
lo primero del sistema que deja de ser legal.**

> Lo reversible que es: cambiar esto es cambiar la marca, no el CSS. Si algún
> día hay dominio propio o `rifate.com`, el TLD adentro del logotipo envejece.

## Al construir

- [x] `src/styles/global.css` con estos tokens como custom properties
- [x] Fuentes por `fontProviders` de Astro (Bricolage Grotesque + Figtree)
- [x] **Iconos: `@iconify-json/lucide` vía astro-icon.** Los glifos del canvas
      están dibujados sobre lucide —`check`, `chevron-down`, `plus` y `share-2`
      calcan exacto—, así que la colección es la base y no un reemplazo. El
      logotipo del ticket vive en `src/icons/ticket.svg` porque su perforación
      punteada es marca, no icono. La G de Google sale de `@iconify-json/logos`.
- [ ] `tabular-nums` en todo lo que sea número
- [ ] Grilla: 5 columnas en celular (64px), 10 en escritorio (60px)
- [ ] Barra de compra fija abajo en la pública
- [ ] Revisar los textos de [errores](./02-arquitectura.md#errores) contra la
      regla 4: hoy están escritos correctos, no barriales

> La regla 8 —ningún estado depende sólo del color— **también aplica a la imagen
> OG**, que mucha gente ve en el preview de WhatsApp sin abrir el link.
