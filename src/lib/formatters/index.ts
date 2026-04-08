export const formatCurrency = (value: number, showCurrency: boolean = true) => {
  const formatter = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    useGrouping: true,
  });
  return `${formatter.format(value)} ${showCurrency ? "ARS" : ""}`.trim();
}

export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${(value * 100).toFixed(decimals)}%`;
}

export const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions) => {
  return Intl.DateTimeFormat("es-AR", options).format(date);
}

export const formatRaffleNumber = (number: number, pad: number): string => {
  return String(number).padStart(pad, "0");
}
