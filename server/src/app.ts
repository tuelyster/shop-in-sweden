import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type {
  CrossingFeeKind,
  CrossingId,
  DiscountAgreement,
  MultiTripBracket,
  ReferenceData,
  SeasonId,
} from '@shop-in-sweden/shared';
import type { Db } from './db/connection';
import { crossingFees, crossings, destinations, seasons } from './db/schema';

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
function loadReferenceData(db: Db, tripDate: string): ReferenceData {
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
  return {
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

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function createApp(db: Db): Hono {
  const app = new Hono();
  app.get('/api/reference-data', (c) => {
    const tripDate = c.req.query('dato') ?? todayIso();
    if (!isRealIsoDate(tripDate)) {
      return c.json({ error: 'dato must be a date in the form YYYY-MM-DD' }, 400);
    }
    return c.json(loadReferenceData(db, tripDate));
  });
  return app;
}
