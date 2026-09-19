/**
 * Los números que venían tildados, para repoblar la grilla tras un error de
 * validación. Lo que no sea un entero se descarta en silencio: el `value` de
 * un checkbox lo puede escribir cualquiera, y acá no se valida nada — de eso
 * se encarga el esquema de la action.
 */
export const selectedNumbers = (formData: FormData | null): number[] =>
  (formData?.getAll('numbers') ?? [])
    .map((entry) => Number(entry))
    .filter((n) => Number.isInteger(n));
