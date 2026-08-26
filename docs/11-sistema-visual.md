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

| Familia | Para qué |
|---|---|
| **Bricolage Grotesque** (700, 800) | Sólo títulos y cifras grandes. `letter-spacing: -0.025em` |
| **Figtree** (400–900) | Todo el texto corrido y la interfaz |

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

- [ ] Cerrar: componentes propios sobre los tokens, y una librería sólo si
      aparece algo complejo de verdad (un dropdown accesible, por ejemplo)

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
