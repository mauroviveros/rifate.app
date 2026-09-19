/**
 * Lo que se deriva para que alguien lo LEA: nombres, plata, fechas, avance.
 *
 * Nada de acá toca la base. Si el valor tiene que quedar guardado, el que manda
 * es `normalize.ts` — este archivo es la punta opuesta del mismo eje.
 */

export { inDays, longDate, shortDate, today } from './dates';
export { initials } from './initials';
export { pesos } from './money';
export { progress } from './progress';
