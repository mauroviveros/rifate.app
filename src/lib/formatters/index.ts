export const formatCurrency = (value: number) => {
  const formatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: 'ARS',
  });
  return `${formatter.format(value)} ARS`;
}

export const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(2)}%`;
}

export const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions) => {
  return Intl.DateTimeFormat("es-AR", options).format(date);
}

export const formatRaffleNumber = (number: number, pad: number): string => {
  return String(number).padStart(pad, "0");
}
