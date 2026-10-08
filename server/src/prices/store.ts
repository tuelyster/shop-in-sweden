import { desc, eq } from 'drizzle-orm';
import type { Quantity, UnitSymbol } from '@shop-in-sweden/shared';
import type { Db } from '../db/connection';
import { exchangeRates, importRuns, priceObservations } from '../db/schema';

/** A price as an importer reports it, before it is stored. */
export interface ObservationDraft {
  source: string;
  retailerId: string;
  /** Only for observations tied to one Store (Swedish Offers). */
  storeId?: string | null;
  productId: string;
  productText: string;
  /** The search words that returned the product. */
  foundBy: string[];
  price: number;
  currency: 'SEK' | 'DKK';
  quantity: Quantity | null;
  /** Deposit the source reports for the whole pack, in the price's currency. */
  deposit?: number | null;
  kind: 'regular' | 'offer';
  memberOnly?: boolean;
  /** ISO dates, YYYY-MM-DD. */
  validFrom: string;
  validTo?: string | null;
}

export interface PriceObservation extends ObservationDraft {
  id: number;
  importRunId: number;
  /** ISO timestamp. */
  importedAt: string;
}

export interface ExchangeRateDraft {
  /** ISO date the rate applies to. */
  date: string;
  /** DKK per 1 SEK. */
  sekToDkk: number;
  source: string;
}

export interface ExchangeRate extends ExchangeRateDraft {
  importedAt: string;
}

export interface ImportRun {
  id: number;
  source: string;
  startedAt: string;
  finishedAt: string;
  outcome: 'success' | 'failed';
  observationCount: number;
  error: string | null;
}

/** Records one importer run and everything it produced in one transaction. Observations are only ever added. */
export function recordImportRun(
  db: Db,
  run: {
    source: string;
    startedAt: Date;
    finishedAt: Date;
    error?: string;
    observations?: ObservationDraft[];
    exchangeRates?: ExchangeRateDraft[];
  },
): ImportRun {
  const observations = run.observations ?? [];
  const rates = run.exchangeRates ?? [];
  const importedAt = run.finishedAt.toISOString();
  return db.transaction((tx) => {
    const row = tx
      .insert(importRuns)
      .values({
        source: run.source,
        startedAt: run.startedAt.toISOString(),
        finishedAt: importedAt,
        outcome: run.error ? 'failed' : 'success',
        observationCount: observations.length + rates.length,
        error: run.error ?? null,
      })
      .returning()
      .get();
    for (const o of observations) {
      tx.insert(priceObservations)
        .values({
          importRunId: row.id,
          source: o.source,
          retailerId: o.retailerId,
          storeId: o.storeId ?? null,
          productId: o.productId,
          productText: o.productText,
          foundBy: JSON.stringify(o.foundBy),
          price: o.price,
          currency: o.currency,
          pieces: o.quantity?.pieces ?? null,
          size: o.quantity?.size ?? null,
          unit: o.quantity?.unit ?? null,
          deposit: o.deposit ?? null,
          kind: o.kind,
          memberOnly: o.memberOnly ?? false,
          validFrom: o.validFrom,
          validTo: o.validTo ?? null,
          importedAt,
        })
        .run();
    }
    for (const r of rates) {
      tx.insert(exchangeRates)
        .values({ importRunId: row.id, date: r.date, sekToDkk: r.sekToDkk, source: r.source, importedAt })
        .run();
    }
    return { ...row, outcome: row.outcome as ImportRun['outcome'] };
  });
}

export function listImportRuns(db: Db): ImportRun[] {
  return db
    .select()
    .from(importRuns)
    .orderBy(importRuns.id)
    .all()
    .map((r) => ({ ...r, outcome: r.outcome as ImportRun['outcome'] }));
}

/** All stored Price Observations, oldest first. Observations are never overwritten, so history is included. */
export function listPriceObservations(db: Db, filter: { source?: string } = {}): PriceObservation[] {
  const rows = filter.source
    ? db.select().from(priceObservations).where(eq(priceObservations.source, filter.source)).orderBy(priceObservations.id).all()
    : db.select().from(priceObservations).orderBy(priceObservations.id).all();
  return rows.map((r) => ({
    id: r.id,
    importRunId: r.importRunId,
    importedAt: r.importedAt,
    source: r.source,
    retailerId: r.retailerId,
    storeId: r.storeId,
    productId: r.productId,
    productText: r.productText,
    foundBy: JSON.parse(r.foundBy) as string[],
    price: r.price,
    currency: r.currency as 'SEK' | 'DKK',
    quantity:
      r.pieces !== null && r.size !== null && r.unit !== null
        ? { pieces: r.pieces, size: r.size, unit: r.unit as UnitSymbol }
        : null,
    deposit: r.deposit,
    kind: r.kind as 'regular' | 'offer',
    memberOnly: r.memberOnly,
    validFrom: r.validFrom,
    validTo: r.validTo,
  }));
}

/** The most recently imported exchange rate, or null when none has been imported. */
export function latestExchangeRate(db: Db): ExchangeRate | null {
  const row = db.select().from(exchangeRates).orderBy(desc(exchangeRates.date), desc(exchangeRates.id)).limit(1).get();
  return row ? { date: row.date, sekToDkk: row.sekToDkk, source: row.source, importedAt: row.importedAt } : null;
}
