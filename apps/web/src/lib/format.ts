// Quantities as people read them in India-based reports: 1,200 / 12,34,567 grouping via en-IN.
export const qty = (n: number | string | null | undefined) => Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
