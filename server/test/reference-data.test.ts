import { beforeAll, describe, expect, it } from 'vitest';
import type { ReferenceData } from '@shop-in-sweden/shared';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/connection';
import { seedDatabase } from '../src/seed';

const isoDate = expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/);

describe('GET /api/reference-data', () => {
  let body: ReferenceData;

  beforeAll(async () => {
    const db = openDatabase(':memory:');
    seedDatabase(db);
    const res = await createApp(db).request('/api/reference-data');
    expect(res.status).toBe(200);
    body = (await res.json()) as ReferenceData;
  });

  it('returns both Crossings with their Destinations', () => {
    expect(body.crossings.map((c) => [c.id, c.destination.id])).toEqual([
      ['bridge', 'hyllie'],
      ['ferry', 'vala'],
    ]);
  });

  it('returns the default Crossing Fees with valid-from date and source', () => {
    const bridge = body.crossings.find((c) => c.id === 'bridge')!;
    const ferry = body.crossings.find((c) => c.id === 'ferry')!;
    expect(bridge.fees).toEqual([
      {
        kind: 'single',
        priceDkk: 420,
        validFrom: isoDate,
        source: expect.stringContaining('oresundsbron.com/da/priser'),
      },
    ]);
    expect(ferry.fees).toEqual([
      {
        kind: 'round-trip',
        priceDkk: 595,
        validFrom: isoDate,
        source: expect.stringContaining('oresundslinjen.dk/priser'),
      },
    ]);
  });
});
