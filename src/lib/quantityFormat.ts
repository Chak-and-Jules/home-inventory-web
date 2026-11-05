/** Presentation only: editable amounts and API payloads retain their original precision. */
export function formatQuantity(value: number, language = 'en'): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 20 }).format(value);
}
