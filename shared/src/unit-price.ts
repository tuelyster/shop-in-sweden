/** Units a pack size can be expressed in, with the factor to the base unit (kg, l or pcs). */
const UNIT_FACTORS = {
  kg: { per: 'kg', factor: 1 },
  g: { per: 'kg', factor: 0.001 },
  l: { per: 'l', factor: 1 },
  dl: { per: 'l', factor: 0.1 },
  cl: { per: 'l', factor: 0.01 },
  ml: { per: 'l', factor: 0.001 },
  pcs: { per: 'pcs', factor: 1 },
} as const;

export type UnitSymbol = keyof typeof UNIT_FACTORS;
/** What a Unit Price is normalised to. */
export type BaseUnit = 'kg' | 'l' | 'pcs';

/** What a price buys: `pieces` items of `size` `unit` each. */
export interface Quantity {
  pieces: number;
  size: number;
  unit: UnitSymbol;
}

/** The total content of a quantity in its base unit, e.g. 15 x 33 cl is 4.95 l. */
export function totalContent(q: Quantity): { amount: number; per: BaseUnit } {
  const { per, factor } = UNIT_FACTORS[q.unit];
  return { amount: q.pieces * q.size * factor, per };
}

/** Unit Price = price / (pieces x size x unit factor), per kg, per litre or per piece. */
export function unitPrice(price: number, q: Quantity): { value: number; per: BaseUnit } {
  const { amount, per } = totalContent(q);
  return { value: price / amount, per };
}
