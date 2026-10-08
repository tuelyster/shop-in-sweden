import type { BaseUnit, Quantity } from '@shop-in-sweden/shared';
import { readCatalogue, type BasketItem, type Category, type Retailer } from '../catalogue';
import type { Db } from '../db/connection';
import { latestExchangeRate, listPriceObservations, type ExchangeRate, type PriceObservation } from '../prices/store';
import { evaluateCandidate, type Country } from './match-rule';

export interface Product {
  retailer: string;
  text: string;
  price: number;
  currency: 'SEK' | 'DKK';
  quantity: Quantity | null;
}

export interface Picked extends Product {
  unitPrice: { value: number; per: BaseUnit };
  /** The Unit Price in DKK; null for a Swedish product when no exchange rate has been imported. */
  unitPriceDkk: number | null;
  retailerId: string;
  /** Set for observations tied to one Store (Swedish Offers); null for national regular prices. */
  storeId: string | null | undefined;
  kind: 'regular' | 'offer';
  validTo: string | null;
}

export interface Rejected extends Product {
  reason: string;
}

export interface CountryMatch {
  country: Country;
  /** The cheapest accepted product by Unit Price, or null when the Basket Item has no price here. */
  picked: Picked | null;
  /** How many products the Match Rule accepted. */
  accepted: number;
  /** Products that looked like the Basket Item by name but were rejected, and why. */
  rejected: Rejected[];
  /** Products that did not look like the Basket Item at all. */
  unrelated: number;
}

export interface ItemMatch {
  category: Category;
  item: BasketItem;
  DK: CountryMatch;
  SE: CountryMatch;
}

export interface MatchReport {
  exchangeRate: ExchangeRate | null;
  items: ItemMatch[];
}

/**
 * The Price Observations that can set a price: the newest regular price of every product. Ticket 09
 * adds the Offers valid on the Trip Date here, so Price Gaps and the report both pick them up.
 */
export function candidateObservations(observations: PriceObservation[]): PriceObservation[] {
  const latest = new Map<string, PriceObservation>();
  for (const o of observations) {
    if (o.kind !== 'regular') continue;
    latest.set(`${o.retailerId}|${o.storeId ?? ''}|${o.productId}`, o);
  }
  return [...latest.values()];
}

/**
 * Evaluates the Match Rule of one Basket Item on the candidate observations of one country and picks the
 * cheapest accepted product by Unit Price. `include` narrows the observations, e.g. to one Destination's Stores.
 */
export function matchItem(
  item: BasketItem,
  country: Country,
  observations: PriceObservation[],
  retailers: Map<string, Retailer>,
  rate: ExchangeRate | null,
  include: (o: PriceObservation) => boolean = () => true,
): CountryMatch {
  const result: CountryMatch = { country, picked: null, accepted: 0, rejected: [], unrelated: 0 };
  for (const o of observations) {
    const retailer = retailers.get(o.retailerId);
    if (!retailer || retailer.country !== country || !include(o)) continue;
    const product: Product = {
      retailer: retailer.name,
      text: o.productText,
      price: o.price,
      currency: o.currency,
      quantity: o.quantity,
    };
    const verdict = evaluateCandidate(item.matchRule, country, {
      text: o.productText,
      foundBy: o.foundBy,
      quantity: o.quantity,
    });
    if (!verdict.accepted) {
      if (verdict.nameMatched) result.rejected.push({ ...product, reason: verdict.reason });
      else result.unrelated++;
      continue;
    }
    result.accepted++;
    const value = verdict.unitPrice(o.price);
    if (!result.picked || value < result.picked.unitPrice.value) {
      const per = item.matchRule.unit;
      const unitPriceDkk = o.currency === 'DKK' ? value : rate ? value * rate.sekToDkk : null;
      result.picked = {
        ...product,
        unitPrice: { value, per },
        unitPriceDkk,
        retailerId: o.retailerId,
        storeId: o.storeId,
        kind: o.kind,
        validTo: o.validTo ?? null,
      };
    }
  }
  return result;
}

/**
 * Applies the Match Rules to the stored Price Observations. Nothing about matching is stored, so
 * editing a rule and building the report again changes the result without a re-import.
 */
export function buildMatchReport(db: Db): MatchReport {
  const catalogue = readCatalogue(db);
  const rate = latestExchangeRate(db);
  const retailers = new Map(catalogue.retailers.map((r) => [r.id, r]));
  const observations = candidateObservations(listPriceObservations(db));

  const items: ItemMatch[] = catalogue.basketItems.map((item) => ({
    category: catalogue.categories.find((c) => c.id === item.categoryId)!,
    item,
    DK: matchItem(item, 'DK', observations, retailers, rate),
    SE: matchItem(item, 'SE', observations, retailers, rate),
  }));

  return { exchangeRate: rate, items };
}

const MAX_REJECTED_SHOWN = 8;

function money(n: number): string {
  return n.toFixed(2);
}

function describeQuantity(q: Quantity | null): string {
  if (!q) return 'size unknown';
  const size = q.unit === 'pcs' ? `${q.size * q.pieces} pcs` : `${q.pieces > 1 ? `${q.pieces} x ` : ''}${q.size} ${q.unit}`;
  return size;
}

function formatCountry(match: CountryMatch): string[] {
  const label = match.country === 'DK' ? 'Denmark' : 'Sweden';
  const lines: string[] = [];
  const p = match.picked;
  if (p) {
    const unit = `${money(p.unitPrice.value)} ${p.currency}/${p.unitPrice.per}`;
    const dkk = p.currency === 'SEK' ? (p.unitPriceDkk !== null ? ` = ${money(p.unitPriceDkk)} DKK/${p.unitPrice.per}` : ' (no exchange rate)') : '';
    lines.push(`    ${label}: PICKED ${p.retailer}: ${p.text}`);
    lines.push(`      ${money(p.price)} ${p.currency} for ${describeQuantity(p.quantity)} = ${unit}${dkk}  (cheapest of ${match.accepted} accepted)`);
  } else {
    lines.push(`    ${label}: NO PRICE (${match.rejected.length} rejected, ${match.unrelated} unrelated products)`);
  }
  const shown = match.rejected.slice(0, MAX_REJECTED_SHOWN);
  for (const r of shown) lines.push(`      rejected ${r.retailer}: ${r.text} (${money(r.price)} ${r.currency}): ${r.reason}`);
  if (match.rejected.length > shown.length) lines.push(`      ... and ${match.rejected.length - shown.length} more rejected`);
  return lines;
}

/** The match report as text for the maintainer. */
export function formatMatchReport(report: MatchReport): string {
  const lines: string[] = ['MATCH REPORT'];
  lines.push(
    report.exchangeRate
      ? `Exchange rate: 1 SEK = ${report.exchangeRate.sekToDkk.toFixed(4)} DKK (${report.exchangeRate.source}, ${report.exchangeRate.date})`
      : 'Exchange rate: none imported yet, Swedish prices are shown in SEK only',
  );
  let currentCategory = '';
  for (const entry of report.items) {
    if (entry.category.id !== currentCategory) {
      currentCategory = entry.category.id;
      lines.push('', `${entry.category.name}`);
    }
    lines.push(`  ${entry.item.name}`);
    lines.push(...formatCountry(entry.DK), ...formatCountry(entry.SE));
  }
  const missing = report.items.filter((e) => !e.DK.picked || !e.SE.picked);
  lines.push('', 'Basket Items without a price');
  if (missing.length === 0) lines.push('  none');
  for (const e of missing) {
    const where = [!e.DK.picked ? 'Denmark' : null, !e.SE.picked ? 'Sweden' : null].filter(Boolean).join(' and ');
    lines.push(`  ${e.item.name}: no price in ${where}`);
  }
  return lines.join('\n');
}
