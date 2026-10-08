import type { BaseUnit, Quantity } from '@shop-in-sweden/shared';
import { readCatalogue, type BasketItem, type Category, type Retailer } from '../catalogue';
import type { Db } from '../db/connection';
import { latestExchangeRate, listPriceObservations, type ExchangeRate, type PriceObservation } from '../prices/store';
import { nextSaturday } from '../dates';
import { LOST_DEPOSIT_CATEGORY_ID, lostDepositFor, readLostDepositRates, type LostDepositRate } from './lost-deposit';
import { evaluateCandidate, textMatchesPhrase, type Country } from './match-rule';

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
  /** Lost Deposit in SEK inside `price`'s Unit Price, for the whole pack; 0 when none applies (Danish prices, other Categories). */
  lostDeposit: number;
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
  tripDate: string;
  exchangeRate: ExchangeRate | null;
  items: ItemMatch[];
}

/** An Offer that cannot set a price, and why. */
export interface ExcludedOffer {
  observation: PriceObservation;
  reason: string;
}

export interface Candidates {
  candidates: PriceObservation[];
  excludedOffers: ExcludedOffer[];
}

/** Offers that ended longer ago than this before the Trip Date are not worth reporting as rejected. */
const REPORT_EXPIRED_WITHIN_DAYS = 14;

function daysBefore(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * The Price Observations that can set a price on a Trip Date: the newest regular price of every
 * product, and the newest version of every Offer that is valid on the Trip Date
 * (valid-from <= Trip Date <= valid-to, as local dates) and not member-only. The other Offers are
 * returned as excluded, with the reason, for the match report.
 */
export function selectCandidates(observations: PriceObservation[], tripDate: string): Candidates {
  const latest = new Map<string, PriceObservation>();
  for (const o of observations) latest.set(`${o.kind}|${o.retailerId}|${o.storeId ?? ''}|${o.productId}`, o);

  const candidates: PriceObservation[] = [];
  const excludedOffers: ExcludedOffer[] = [];
  for (const o of latest.values()) {
    if (o.kind === 'regular') {
      candidates.push(o);
      continue;
    }
    const valid = o.validFrom <= tripDate && (o.validTo === null || o.validTo === undefined || tripDate <= o.validTo);
    if (!valid) {
      if (!o.validTo || o.validTo >= daysBefore(tripDate, REPORT_EXPIRED_WITHIN_DAYS)) {
        excludedOffers.push({ observation: o, reason: `Offer valid ${o.validFrom} to ${o.validTo ?? 'open end'}, not on Trip Date ${tripDate}` });
      }
    } else if (o.memberOnly) {
      excludedOffers.push({ observation: o, reason: 'member-only Offer' });
    } else {
      candidates.push(o);
    }
  }
  return { candidates, excludedOffers };
}

/** The Price Observations that can set a price on a Trip Date; see `selectCandidates`. */
export function candidateObservations(observations: PriceObservation[], tripDate: string): PriceObservation[] {
  return selectCandidates(observations, tripDate).candidates;
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
  excludedOffers: ExcludedOffer[] = [],
  depositRates: LostDepositRate[] = [],
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
      foundBy: foundBy(item, country, o),
      quantity: o.quantity,
    });
    if (!verdict.accepted) {
      if (verdict.nameMatched) result.rejected.push({ ...product, reason: verdict.reason });
      else result.unrelated++;
      continue;
    }
    result.accepted++;
    // Swedish soft drinks: the deposit a Danish shopper cannot reclaim is part of what the pack costs.
    const lostDeposit =
      country === 'SE' && item.categoryId === LOST_DEPOSIT_CATEGORY_ID
        ? lostDepositFor(o, depositRates, !item.matchRule.noDerivedDeposit)
        : 0;
    const value = verdict.unitPrice(o.price + lostDeposit);
    if (!result.picked || value < result.picked.unitPrice.value) {
      const per = item.matchRule.unit;
      const unitPriceDkk = o.currency === 'DKK' ? value : rate ? value * rate.sekToDkk : null;
      result.picked = {
        ...product,
        unitPrice: { value, per },
        unitPriceDkk,
        lostDeposit,
        retailerId: o.retailerId,
        storeId: o.storeId,
        kind: o.kind,
        validTo: o.validTo ?? null,
      };
    }
  }
  for (const { observation: o, reason } of excludedOffers) {
    const retailer = retailers.get(o.retailerId);
    if (!retailer || retailer.country !== country || !include(o)) continue;
    const verdict = evaluateCandidate(item.matchRule, country, { text: o.productText, foundBy: foundBy(item, country, o), quantity: o.quantity });
    if (!verdict.accepted && !verdict.nameMatched) continue;
    result.rejected.push({ retailer: retailer.name, text: o.productText, price: o.price, currency: o.currency, quantity: o.quantity, reason });
  }
  return result;
}

/**
 * Offers are not found by searching, so the search words that "found" one are the current search
 * words its text contains; stored regular prices keep the words that returned them.
 */
function foundBy(item: BasketItem, country: Country, o: PriceObservation): string[] {
  return o.kind === 'offer' ? item.matchRule.searchWords[country].filter((w) => textMatchesPhrase(o.productText, w)) : o.foundBy;
}

/**
 * Applies the Match Rules to the stored Price Observations. Nothing about matching is stored, so
 * editing a rule and building the report again changes the result without a re-import.
 */
export function buildMatchReport(db: Db, tripDate: string = nextSaturday(new Date())): MatchReport {
  const catalogue = readCatalogue(db);
  const rate = latestExchangeRate(db);
  const retailers = new Map(catalogue.retailers.map((r) => [r.id, r]));
  const { candidates: observations, excludedOffers } = selectCandidates(listPriceObservations(db), tripDate);
  const depositRates = readLostDepositRates(db);

  const items: ItemMatch[] = catalogue.basketItems.map((item) => ({
    category: catalogue.categories.find((c) => c.id === item.categoryId)!,
    item,
    DK: matchItem(item, 'DK', observations, retailers, rate, undefined, excludedOffers, depositRates),
    SE: matchItem(item, 'SE', observations, retailers, rate, undefined, excludedOffers, depositRates),
  }));

  return { tripDate, exchangeRate: rate, items };
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
    const offer = p.kind === 'offer' ? ` [Offer, valid until ${p.validTo ?? 'further notice'}]` : '';
    lines.push(`    ${label}: PICKED ${p.retailer}: ${p.text}${offer}`);
    const deposit = p.lostDeposit > 0 ? ` + ${money(p.lostDeposit)} ${p.currency} Lost Deposit = ${money(p.price + p.lostDeposit)} ${p.currency}` : '';
    lines.push(`      ${money(p.price)} ${p.currency}${deposit} for ${describeQuantity(p.quantity)} = ${unit}${dkk}  (cheapest of ${match.accepted} accepted)`);
  } else {
    lines.push(`    ${label}: NO PRICE (${match.rejected.length} rejected, ${match.unrelated} unrelated products)`);
  }
  // Member-only Offers first, so they are never lost behind the cap.
  const ordered = [...match.rejected].sort((a, b) => Number(b.reason.startsWith('member-only')) - Number(a.reason.startsWith('member-only')));
  const shown = ordered.slice(0, MAX_REJECTED_SHOWN);
  for (const r of shown) lines.push(`      rejected ${r.retailer}: ${r.text} (${money(r.price)} ${r.currency}): ${r.reason}`);
  if (match.rejected.length > shown.length) lines.push(`      ... and ${match.rejected.length - shown.length} more rejected`);
  return lines;
}

/** The match report as text for the maintainer. */
export function formatMatchReport(report: MatchReport): string {
  const lines: string[] = ['MATCH REPORT', `Trip Date: ${report.tripDate} (Offers valid that day count; member-only Offers never do)`];
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
