/**
 * One-off script: builds server/seed/postcode-distances.json, the one-way road distance (km)
 * from each Danish postcode's centre point to each Destination, via its Crossing and
 * EXCLUDING the ferry leg.
 *
 *   npm run distances:build -w server
 *
 * It is NOT run by the tests or by `npm run seed`; the committed JSON is the seed input.
 * Re-run only when the postcode list or the routing data should be refreshed.
 *
 * Sources (see ticket 05):
 *  - Postcode centre points: GeoNames postal-code dump for Denmark (CC BY 4.0),
 *    https://download.geonames.org/export/zip/DK.zip. (DAWA / api.dataforsyningen.dk
 *    /postnumre was shut down and now answers 410 Gone.)
 *  - Routing: the public OSRM demo server, car profile, one request at a time with a pause
 *    between requests (its fair-use policy). Results are cached in data/postcode-routes-cache.json
 *    so an interrupted run resumes.
 *
 * Distances:
 *  - hyllie (bridge): road route postcode centre -> Hyllie/Emporia, Malmö, over the Oresund Bridge.
 *  - vala (ferry): road route postcode centre -> Helsingør ferry terminal, PLUS the road route
 *    Helsingborg ferry terminal -> Väla Centrum. The ferry itself is never routed.
 *
 * The router cannot be told to avoid ferries, so every route is requested with steps and any
 * route that uses a ferry is rejected. A start on Funen/Jutland that the router would send over
 * a ferry is retried via the Great Belt Bridge. A postcode that still needs a ferry (Bornholm,
 * Ærø, Samsø, Læsø, Fanø and the other islands without a road link) is OMITTED from the table,
 * so the lookup reports it as unknown.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outFile = resolve(root, 'server/seed/postcode-distances.json');
const cacheFile = resolve(root, 'data/postcode-routes-cache.json');

type LonLat = readonly [number, number];
const HYLLIE: LonLat = [12.9759, 55.5636];
const HELSINGOER_TERMINAL: LonLat = [12.6136, 56.0361];
const HELSINGBORG_TERMINAL: LonLat = [12.6955, 56.0434];
const VALA: LonLat = [12.776, 56.082];
// Waypoints that force the Great Belt Bridge (Funen side, Zealand side).
const GREAT_BELT: LonLat[] = [
  [10.8, 55.31],
  [11.15, 55.33],
];

const OSRM = process.env.OSRM_URL ?? 'https://router.project-osrm.org';
const PAUSE_MS = 1100;
const HEADERS = { 'User-Agent': 'shop-in-sweden-distance-script (tue@lyster.dk)' };

interface Centre {
  postcode: string;
  name: string;
  lon: number;
  lat: number;
}

/** Reads one named entry of a zip file (deflate or stored) without a dependency. */
function readZipEntry(zip: Buffer, wanted: string): string {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0, n = zip.readUInt16LE(eocd + 10); i < n; i++) {
    const method = zip.readUInt16LE(p + 10);
    const compSize = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const localOffset = zip.readUInt32LE(p + 42);
    const name = zip.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const start = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
      const data = zip.subarray(start, start + compSize);
      return (method === 0 ? data : inflateRawSync(data)).toString('utf8');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${wanted} not found in zip`);
}

async function loadCentres(): Promise<Centre[]> {
  const res = await fetch('https://download.geonames.org/export/zip/DK.zip', { headers: HEADERS });
  if (!res.ok) throw new Error(`GeoNames download failed: ${res.status}`);
  const text = readZipEntry(Buffer.from(await res.arrayBuffer()), 'DK.txt');
  const byPostcode = new Map<string, Centre>();
  for (const line of text.split('\n')) {
    const f = line.split('\t');
    const postcode = f[1] ?? '';
    if (f.length < 11 || !/^\d{4}$/.test(postcode)) continue;
    const lat = Number(f[9]);
    const lon = Number(f[10]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!byPostcode.has(postcode)) byPostcode.set(postcode, { postcode, name: f[2] ?? '', lon, lat });
  }
  return [...byPostcode.values()].sort((a, b) => a.postcode.localeCompare(b.postcode));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RouteResult = { km: number } | { ferry: true } | { none: true };
const cache: Record<string, RouteResult> = existsSync(cacheFile)
  ? JSON.parse(readFileSync(cacheFile, 'utf8'))
  : {};

function saveCache() {
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(cache));
}

/** Road route through the given points; flags routes that use a ferry. Cached and throttled. */
async function route(points: LonLat[]): Promise<RouteResult> {
  const coords = points.map((p) => p.join(',')).join(';');
  if (cache[coords]) return cache[coords];
  for (let attempt = 0; ; attempt++) {
    await sleep(PAUSE_MS * (attempt + 1));
    let res: Response;
    try {
      res = await fetch(`${OSRM}/route/v1/driving/${coords}?overview=false&steps=true`, { headers: HEADERS });
    } catch (e) {
      if (attempt >= 5) throw e;
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 5) throw new Error(`OSRM ${res.status}`);
      continue;
    }
    const body = (await res.json()) as {
      code: string;
      routes?: { distance: number; legs: { steps: { mode: string }[] }[] }[];
    };
    let result: RouteResult;
    if (body.code !== 'Ok' || !body.routes?.length) result = { none: true };
    else {
      const r = body.routes[0]!;
      const usesFerry = r.legs.some((l) => l.steps.some((s) => s.mode === 'ferry'));
      result = usesFerry ? { ferry: true } : { km: r.distance / 1000 };
    }
    cache[coords] = result;
    return result;
  }
}

/** Ferry-free route from a start; retries via the Great Belt Bridge for starts west of it. */
async function roadKm(start: LonLat, end: LonLat): Promise<number | null> {
  const direct = await route([start, end]);
  if ('km' in direct) return direct.km;
  if ('ferry' in direct && start[0] < 10.8) {
    const viaBelt = await route([start, ...GREAT_BELT, end]);
    if ('km' in viaBelt) return viaBelt.km;
  }
  return null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

async function main() {
  const centres = await loadCentres();
  console.log(`${centres.length} postcodes`);
  const valaLeg = await route([HELSINGBORG_TERMINAL, VALA]);
  if (!('km' in valaLeg)) throw new Error('Cannot route Helsingborg terminal -> Väla');
  const rows: { postcode: string; name: string; hyllie: number; vala: number }[] = [];
  const omitted: string[] = [];
  let n = 0;
  for (const c of centres) {
    const start: LonLat = [c.lon, c.lat];
    const bridge = await roadKm(start, HYLLIE);
    const toTerminal = bridge === null ? null : await roadKm(start, HELSINGOER_TERMINAL);
    if (bridge === null || toTerminal === null) omitted.push(`${c.postcode} ${c.name}`);
    else rows.push({ postcode: c.postcode, name: c.name, hyllie: round1(bridge), vala: round1(toTerminal + valaLeg.km) });
    if (++n % 25 === 0) {
      saveCache();
      console.log(`${n}/${centres.length}`);
    }
  }
  saveCache();
  writeFileSync(outFile, '[\n' + rows.map((r) => JSON.stringify(r)).join(',\n') + '\n]\n');
  console.log(`Wrote ${rows.length} postcodes to ${outFile}`);
  console.log(`Omitted (no ferry-free road link): ${omitted.length}\n${omitted.join('\n')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
