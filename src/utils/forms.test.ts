import { describe, expect, it } from 'vitest';

import { formValue, numberOr } from './forms';

const formDataWith = (fields: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

describe('formValue', () => {
  it('sin FormData (primera carga de la pantalla) da vacío', () => {
    expect(formValue(null, 'title')).toBe('');
  });

  it('un campo que no vino da vacío, no undefined ni null', () => {
    expect(formValue(formDataWith({}), 'title')).toBe('');
  });

  it('lee el valor tal cual, sin recortar espacios', () => {
    expect(formValue(formDataWith({ title: '  Rifa  ' }), 'title')).toBe(
      '  Rifa  ',
    );
  });

  /* Un <input type="file"> daría un File, no un string; formValue no lo usa
     acá pero el chequeo de tipo es lo que evita que un valor así explote más
     adelante en vez de devolver '' con dignidad. */
  it('algo que no es texto (ej. un File) también da vacío', () => {
    const fd = new FormData();
    fd.set('adjunto', new File([''], 'a.txt'));
    expect(formValue(fd, 'adjunto')).toBe('');
  });
});

describe('numberOr', () => {
  /**
   * `formNumber` es esto mismo leyendo un `FormData`; los casos borde ya están
   * cubiertos ahí abajo. Este describe existe porque `numberOr` tiene un
   * segundo llamador real —el `<script>` cliente de `Summary.astro`, que
   * recalcula el resumen a partir de `input.value` y no tiene ningún
   * `FormData`— y ese llamador se queda sin cobertura si sólo se prueba a
   * través de `formNumber`.
   */
  it('funciona sobre un string suelto, sin pasar por FormData', () => {
    expect(numberOr('250', 100)).toBe(250);
    expect(numberOr('', 100)).toBe(100);
    expect(numberOr('   ', 100)).toBe(100);
    expect(numberOr('1e400', 100)).toBe(100);
  });

  /**
   * El 0 y los negativos caen al fallback: ver el comment de `numberOr` para el
   * porqué (arrastrados a una cuenta como `summarySnapshot()`, terminan en un
   * `pesos()` de $0 o negativo mostrado en pantalla).
   */
  it('el 0 y los negativos caen al fallback', () => {
    expect(numberOr('0', 100)).toBe(100);
    expect(numberOr('-50', 100)).toBe(100);
  });
});
