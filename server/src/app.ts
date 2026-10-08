import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { CrossingFeeKind, CrossingId, ReferenceData } from '@shop-in-sweden/shared';
import type { Db } from './db/connection';
import { crossingFees, crossings, destinations } from './db/schema';

function loadReferenceData(db: Db): ReferenceData {
  const rows = db
    .select()
    .from(crossings)
    .innerJoin(destinations, eq(destinations.crossingId, crossings.id))
    .all();
  const fees = db.select().from(crossingFees).all();
  return {
    crossings: rows.map(({ crossings: c, destinations: d }) => ({
      id: c.id as CrossingId,
      name: c.name,
      destination: { id: d.id, name: d.name },
      fees: fees
        .filter((f) => f.crossingId === c.id)
        .map((f) => ({
          kind: f.kind as CrossingFeeKind,
          priceDkk: f.priceDkk,
          validFrom: f.validFrom,
          source: f.source,
        })),
    })),
  };
}

export function createApp(db: Db): Hono {
  const app = new Hono();
  app.get('/api/reference-data', (c) => c.json(loadReferenceData(db)));
  return app;
}
