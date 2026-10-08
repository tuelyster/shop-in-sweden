import { eq, max } from 'drizzle-orm';
import { Hono } from 'hono';
import type {
  CrossingFeeKind,
  CrossingId,
  DataFreshness,
  DiscountAgreement,
  EnergyType,
  MultiTripBracket,
  PetrolPriceInfo,
  ReferenceData,
  SeasonId,
} from '@shop-in-sweden/shared';
import { readCatalogue } from './catalogue';
import type { Db } from './db/connection';
import { measurePriceGaps } from './match/price-gaps';
import { latestPetrolPrice, type PetrolPrice } from './prices/store';
import { crossingFees, crossings, destinations, priceObservations, seasons, vehicleDefaults } from './db/schema';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealIsoDate(raw: string): boolean {
  const m = ISO_DATE.exec(raw);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * Reference data for a Trip Date: only fees already valid on that date are included.
 * Which season and Discount Agreement price applies is left to the calculator.
 */
function loadReferenceData(db: Db, tripDate: string, today: string): ReferenceData {
  const rows = db
    .select()
    .from(crossings)
    .innerJoin(destinations, eq(destinations.crossingId, crossings.id))
    .all();
  const fees = db
    .select()
    .from(crossingFees)
    .all()
    .filter((f) => f.validFrom <= tripDate);
  const priceGaps = measurePriceGaps(db, tripDate);
  const danishPetrol = latestPetrolPrice(db, 'DK');
  return {
    categories: readCatalogue(db).categories,
    priceGaps: priceGaps.destinations,
    exchangeRate: priceGaps.exchangeRate,
    freshness: measureFreshness(db, today),
    vehicleDefaults: db
      .select()
      .from(vehicleDefaults)
      .all()
      .map((v) => ({ ...v, energyType: v.energyType as EnergyType }))
      // The imported Danish petrol price replaces the manually seeded one; the seed stays as fallback.
      .map((v) =>
        v.energyType === 'petrol' && danishPetrol
          ? { ...v, energyPriceDkk: danishPetrol.pricePerLitre, priceSource: danishPetrol.source, priceDate: danishPetrol.date }
          : v,
      ),
    petrolPrices: { denmark: petrolInfo(danishPetrol), sweden: petrolInfo(latestPetrolPrice(db, 'SE')) },
    seasons: db
      .select()
      .from(seasons)
      .all()
      .map((s) => ({
        id: s.id as SeasonId,
        startMonthDay: s.startMonthDay,
        endMonthDay: s.endMonthDay,
        source: s.source,
      })),
    crossings: rows.map(({ crossings: c, destinations: d }) => ({
      id: c.id as CrossingId,
      name: c.name,
      destination: { id: d.id, name: d.name },
      fees: fees
        .filter((f) => f.crossingId === c.id)
        .map((f) => ({
          kind: f.kind as CrossingFeeKind,
          priceDkk: f.priceDkk,
          agreement: f.agreement as DiscountAgreement,
          season: f.season as SeasonId | null,
          bracket: f.bracket as MultiTripBracket | null,
          validFrom: f.validFrom,
          source: f.source,
        })),
    })),
  };
}

function petrolInfo(p: PetrolPrice | null): PetrolPriceInfo | null {
  return p ? { pricePerLitre: p.pricePerLitre, currency: p.currency, date: p.date, source: p.source } : null;
}

/** More than this many days since the newest Price Observation makes the prices stale. */
export const STALE_AFTER_DAYS = 14;

function daysBetween(fromIso: string, toIso: string): number {
  const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  return Math.round((ms(toIso) - ms(fromIso)) / 86_400_000);
}

/**
 * Freshness is the date of the newest import that stored a Price Observation (its import time,
 * not the price's valid-from, which can lie in the future for Offers).
 */
function measureFreshness(db: Db, today: string): DataFreshness {
  const newest = db.select({ at: max(priceObservations.importedAt) }).from(priceObservations).get()?.at ?? null;
  if (!newest) return { newestObservationDate: null, daysOld: null, stale: false };
  const newestObservationDate = newest.slice(0, 10);
  const daysOld = Math.max(0, daysBetween(newestObservationDate, today));
  return { newestObservationDate, daysOld, stale: daysOld > STALE_AFTER_DAYS };
}

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface AppOptions {
  /** The current time; injectable so tests control "today". */
  now?: () => Date;
}

export function createApp(db: Db, options: AppOptions = {}): Hono {
  const now = options.now ?? (() => new Date());
  const app = new Hono();
  app.get('/api/reference-data', (c) => {
    const today = isoDate(now());
    const tripDate = c.req.query('dato') ?? today;
    if (!isRealIsoDate(tripDate)) {
      return c.json({ error: 'dato must be a date in the form YYYY-MM-DD' }, 400);
    }
    return c.json(loadReferenceData(db, tripDate, today));
  });
  return app;
}
