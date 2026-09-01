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

Botones: **altura mínima 56px.** Campos: **altura 60px.**

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
src/styles/starwind.css   lo escribe `starwind init`, lo reescribe `starwind update`.
                          Es el entry de Tailwind y define el CONTRATO:
                          @theme inline { --color-primary: var(--primary) } + :root neutro.
                          NO SE TOCA. Está en .prettierignore y en los ignores de eslint.

src/styles/global.css     nuestro. Importa el anterior y pisa los valores crudos
                          (--primary, --background, …) con Talonario, más los
                          alias de marca y las utilidades de la grilla.
```

Ese doble salto `--color-primary → --primary` parecía indirección de más al no
haber modo oscuro. **Tiene otro pagador:** es la costura que deja al CLI
reescribir su archivo entero sin llevarse el tema puesto.

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

#### Cómo se porta

- Lo del CLI **no se reformatea ni se corrige a mano**: cada arreglo de estilo
  es un conflicto en el próximo `starwind update`.
- Si un componente pide un token que no tenemos (`--info`, `--outline`), se le
  da un **valor diseñado**, no un placeholder. Talonario no tiene azul: un
  aviso informativo es texto sobre papel, y eso es una decisión, no un relleno.
- Lo vendorizado vive en `src/components/starwind/`; lo propio en
  `src/components/`. Que se vea de un vistazo qué es nuestro y qué es de otro.

### 3 · El nombre

Los artboards hablan de **«Talonario»** como nombre del sistema visual. Conviene
que quede claro si es el nombre del design system dentro de rifate.app, o si el
producto pasa a llamarse así.

---

## Al construir

- [ ] `src/global.css` con estos tokens como custom properties
- [ ] Fuentes por `fontProviders` de Astro (Bricolage Grotesque + Figtree)
- [ ] `tabular-nums` en todo lo que sea número
- [ ] Grilla: 5 columnas en celular (64px), 10 en escritorio (60px)
- [ ] Barra de compra fija abajo en la pública
- [ ] Revisar los textos de [errores](./02-arquitectura.md#errores) contra la
      regla 4: hoy están escritos correctos, no barriales

> La regla 8 —ningún estado depende sólo del color— **también aplica a la imagen
> OG**, que mucha gente ve en el preview de WhatsApp sin abrir el link.
