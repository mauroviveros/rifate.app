import { describe, expect, it } from 'vitest';

import { formNumber, formValue, numberOr } from './forms';

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
    expect(numberOr('1e400', 100)).toBe(100);
  });
});

describe('formNumber', () => {
  it('sin FormData da el fallback', () => {
    expect(formNumber(null, 'totalNumbers', 100)).toBe(100);
  });

  it('un número de verdad se respeta', () => {
    expect(
      formNumber(formDataWith({ totalNumbers: '250' }), 'totalNumbers', 100),
    ).toBe(250);
  });

  it('vacío o basura cae al fallback', () => {
    expect(
      formNumber(formDataWith({ totalNumbers: '' }), 'totalNumbers', 100),
    ).toBe(100);
    expect(
      formNumber(formDataWith({ totalNumbers: 'abc' }), 'totalNumbers', 100),
    ).toBe(100);
  });

  /**
   * `Number('') === 0`, así que un `Number(v) || fallback` a secas no
   * distingue "no vino nada" de "vale cero" — acá el 0 nunca es legítimo
   * (cantidad de números, precio), así que se lo trata igual que el vacío. Si
   * algún día se reusa para un campo donde 0 SÍ es válido, este test es el que
   * avisa.
   */
  it('el 0 también cae al fallback: acá nunca es un valor real', () => {
    expect(
      formNumber(formDataWith({ totalNumbers: '0' }), 'totalNumbers', 100),
    ).toBe(100);
  });

  /* Un número que no entra en punto flotante (ej. "1e400" tipeado en un
     <input type="number">) da Infinity, y eso arruina todo lo que se calcule
     después (Array.from({ length: Infinity }) revienta). Cae al fallback en
     vez de propagar el infinito. */
  it('un valor que desborda a Infinity cae al fallback', () => {
    expect(
      formNumber(formDataWith({ totalNumbers: '1e400' }), 'totalNumbers', 100),
    ).toBe(100);
  });
});
