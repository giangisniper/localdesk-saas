/** Parse a user-typed price like "35", "35.5", "35,50" into integer cents. */
export function parsePriceToCents(input: string): number | null {
  const normalized = input.trim().replace(/[^\d.,]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}
