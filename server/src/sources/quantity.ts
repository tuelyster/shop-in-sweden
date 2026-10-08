import type { Quantity, UnitSymbol } from '@shop-in-sweden/shared';

const MEASURE = /(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ltr|l|dl|cl|ml)(?![\p{L}\p{N}])/u;
const MULTI = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ltr|l|dl|cl|ml)(?![\p{L}\p{N}])/u;
const COUNT = /(?<![\p{L}\p{N}.,])(\d+)\s*(?:p|st|stk)(?![\p{L}\p{N}])/u;

function toNumber(text: string): number {
  return Number(text.replace(',', '.'));
}

function toUnit(text: string): UnitSymbol {
  if (text === 'gr') return 'g';
  if (text === 'ltr') return 'l';
  return text as UnitSymbol;
}

/**
 * Reads a pack size from a source's size text, e.g. "1,5l", "15p/33cl", "ca: 2.2kg", "6 STK.", "250 ML.".
 * Returns null when no size can be read ("PAR", "MTR.", empty).
 */
export function parseQuantity(text: string | null | undefined): Quantity | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/\bca\b:?/g, ' ').trim();

  const multi = MULTI.exec(t);
  if (multi) return { pieces: Number(multi[1]), size: toNumber(multi[2]!), unit: toUnit(multi[3]!) };

  const measure = MEASURE.exec(t);
  const count = COUNT.exec(t);
  if (measure) {
    return { pieces: count ? Number(count[1]) : 1, size: toNumber(measure[1]!), unit: toUnit(measure[2]!) };
  }
  if (count) return { pieces: Number(count[1]), size: 1, unit: 'pcs' };
  if (/^(st|stk\.?)$/.test(t)) return { pieces: 1, size: 1, unit: 'pcs' };
  return null;
}
