export const MAX_PRICE_CENTS = 10_000_000; // 100,000.00

/** Parse a user-typed price like "35", "35.5", "35,50" into integer cents. */
export function parsePriceToCents(input: string): number | null {
  const normalized = input.trim().replace(/[^\d.,]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(parseFloat(normalized) * 100);
  return cents > MAX_PRICE_CENTS ? null : cents;
}
