import { totalContent, unitPrice, type BaseUnit, type Quantity } from '@shop-in-sweden/shared';

export type Country = 'DK' | 'SE';

export interface Range {
  min?: number;
  max?: number;
}

/**
 * Decides whether a product counts as a Basket Item: search words, pack-size range and excluded words.
 * Applied when prices are evaluated, never at import time.
 */
export interface MatchRule {
  /** Words sent to the source's product search, one request each. */
  searchWords: Record<Country, string[]>;
  /**
   * Alternatives, each a phrase whose words must all appear in the product text. When omitted, Danish
   * products must contain all words of one search word, and Swedish products only have to have been
   * returned by one of the current search words (Willys searches its own catalogue). An empty list
   * also means "returned by a current search word".
   */
  nameWords?: Partial<Record<Country, string[]>>;
  /** A product whose text contains any of these (case-insensitive substring) is rejected. */
  excludedWords: Record<Country, string[]>;
  /** What the pack size and Unit Price are measured in. */
  unit: BaseUnit;
  /** Range for the pack's total content (pieces x size) in `unit`. */
  packSize: Range;
  /** Optional range for the number of pieces in the pack. */
  pieces?: Range;
  /** Optional range for the size of one piece in `unit`. */
  itemSize?: Range;
  /** Swedish soft drinks: true when no Lost Deposit is derived from the pack (cartons). A deposit the source reports still counts. */
  noDerivedDeposit?: boolean;
}

export interface Candidate {
  text: string;
  foundBy: string[];
  quantity: Quantity | null;
}

export type Verdict =
  | { accepted: true; unitPrice: (price: number) => number }
  | { accepted: false; reason: string; /** True when the product looked like this Basket Item by name. */ nameMatched: boolean };

/** Lower-cases and splits text into words of letters and digits. */
function words(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** A query word matches a product word when equal, a compound ending in it, or (if long enough) starting with it. */
function wordMatches(queryWord: string, productWord: string): boolean {
  if (productWord === queryWord || productWord.endsWith(queryWord)) return true;
  return queryWord.length >= 4 && productWord.startsWith(queryWord);
}

/** Query words that carry meaning: pack sizes ("1,5 l") are left to the pack-size range. */
function significantWords(phrase: string): string[] {
  return words(phrase).filter((w) => w.length >= 2 && !/^\d/.test(w));
}

function phraseMatches(phrase: string, productWords: string[]): boolean {
  const query = significantWords(phrase);
  return query.length > 0 && query.every((q) => productWords.some((p) => wordMatches(q, p)));
}

/** True when every significant word of the phrase appears in the text. */
export function textMatchesPhrase(text: string, phrase: string): boolean {
  return phraseMatches(phrase, words(text));
}

function inRange(value: number, range: Range | undefined): boolean {
  if (!range) return true;
  const epsilon = 1e-9;
  return (range.min === undefined || value >= range.min - epsilon) && (range.max === undefined || value <= range.max + epsilon);
}

export function nameAlternatives(rule: MatchRule, country: Country): string[] | 'found-by' {
  const explicit = rule.nameWords?.[country];
  // Willys does its own search, so by default trust it; Danish products are searched here, by text.
  if (explicit === undefined) return country === 'SE' ? 'found-by' : rule.searchWords[country];
  return explicit.length === 0 ? 'found-by' : explicit;
}

function formatRange(range: Range, unit: string): string {
  if (range.min !== undefined && range.max !== undefined) return `${range.min}-${range.max} ${unit}`;
  if (range.min !== undefined) return `at least ${range.min} ${unit}`;
  return `at most ${range.max} ${unit}`;
}

/** Applies a Match Rule to one product for one country. */
export function evaluateCandidate(rule: MatchRule, country: Country, candidate: Candidate): Verdict {
  const productWords = words(candidate.text);
  const alternatives = nameAlternatives(rule, country);
  const nameMatched =
    alternatives === 'found-by'
      ? candidate.foundBy.some((w) => rule.searchWords[country].includes(w))
      : alternatives.some((phrase) => phraseMatches(phrase, productWords));
  if (!nameMatched) return { accepted: false, reason: 'search words not in product text', nameMatched: false };

  const lower = candidate.text.toLowerCase();
  const excluded = rule.excludedWords[country].find((w) => lower.includes(w.toLowerCase()));
  if (excluded) return { accepted: false, reason: `excluded word "${excluded}"`, nameMatched: true };

  const q = candidate.quantity;
  if (!q) return { accepted: false, reason: 'no pack size could be read', nameMatched: true };
  const content = totalContent(q);
  if (content.per !== rule.unit) {
    return { accepted: false, reason: `pack size is per ${content.per}, expected per ${rule.unit}`, nameMatched: true };
  }
  if (!inRange(content.amount, rule.packSize)) {
    return {
      accepted: false,
      reason: `pack size ${round(content.amount)} ${rule.unit} outside ${formatRange(rule.packSize, rule.unit)}`,
      nameMatched: true,
    };
  }
  if (!inRange(q.pieces, rule.pieces)) {
    return { accepted: false, reason: `${q.pieces} pieces outside the allowed number of pieces`, nameMatched: true };
  }
  const itemSize = content.amount / q.pieces;
  if (!inRange(itemSize, rule.itemSize)) {
    return {
      accepted: false,
      reason: `item size ${round(itemSize)} ${rule.unit} outside ${formatRange(rule.itemSize ?? {}, rule.unit)}`,
      nameMatched: true,
    };
  }
  return { accepted: true, unitPrice: (price) => unitPrice(price, q).value };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
