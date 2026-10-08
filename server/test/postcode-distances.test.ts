import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/connection';
import { seedDatabase } from '../src/seed';

interface Lookup {
  postcode: string;
  name: string;
  distanceKm: { bridge: number; ferry: number };
}

describe('GET /api/postcodes/:postcode/distances', () => {
  let app: ReturnType<typeof createApp>;

  const lookup = async (postcode: string) => (await app.request(`/api/postcodes/${postcode}/distances`)).json() as Promise<Lookup>;

  beforeAll(() => {
    const db = openDatabase(':memory:');
    seedDatabase(db);
    app = createApp(db);
  });

  it('returns the one-way distance to each Destination for a known postcode', async () => {
    const res = await app.request('/api/postcodes/2300/distances');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Lookup;
    expect(body.postcode).toBe('2300');
    expect(body.name).toMatch(/København S/);
    // Copenhagen to Malmö over the bridge is roughly 20-50 km; to Väla via Helsingør roughly 50-90 km.
    expect(body.distanceKm.bridge).toBeGreaterThan(20);
    expect(body.distanceKm.bridge).toBeLessThan(50);
    expect(body.distanceKm.ferry).toBeGreaterThan(50);
    expect(body.distanceKm.ferry).toBeLessThan(90);
  });

  it('gives a far-away postcode a longer distance to both Destinations', async () => {
    const near = await lookup('2300');
    const far = await lookup('8000');
    expect(far.distanceKm.bridge).toBeGreaterThan(near.distanceKm.bridge + 100);
    expect(far.distanceKm.ferry).toBeGreaterThan(near.distanceKm.ferry + 100);
  });

  it('answers 404 unknown-postcode for a well-formed postcode that is not in the table', async () => {
    const res = await app.request('/api/postcodes/0001/distances');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'unknown-postcode' });
  });

  it('treats Bornholm, which has no road link to Sweden, as unknown', async () => {
    const res = await app.request('/api/postcodes/3700/distances');
    expect(res.status).toBe(404);
  });

  it.each(['abc', '12', '12345', '2300x', '23%2000'])('answers 400 for malformed input %j', async (raw) => {
    const res = await app.request(`/api/postcodes/${raw}/distances`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'malformed-postcode' });
  });
});
