# 01: Walking skeleton: compare the two Crossings' fees

**What to build:** A shopper opens the Danish web page and sees the two Shopping Trips side by side, the Øresund Bridge to Hyllie and the Helsingør–Helsingborg ferry to Väla Centrum, each with its round-trip Crossing Fee. The cheaper trip is highlighted.

This is the thinnest end-to-end path, and it sets up everything later tickets build on:

- the client, server and shared workspace packages
- SQLite through Drizzle, with a seed command
- the shared calculator's public function
- the reference-data API
- the test harnesses: Vitest and Playwright

Default fees only: no Discount Agreements, no Trip Date or season yet (use the low-season ferry price). See the spec's "Shape", "Shared calculator module", "Seed data" and "Testing Decisions" sections, and ADR 0001.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Running one command starts the client and server locally. A separate command loads the seed files into a fresh SQLite database.
- [x] Seed files hold the two Crossings, their Destinations, and the default Crossing Fees: the bridge online ticket at 420 kr per single trip, and the ferry same-day round trip at 595 kr (low season). Each fee carries the date it applies from and its source.
- [x] The shared calculator's public function takes trip inputs and reference data. It returns one result per Shopping Trip with its Crossing Fee (bridge 2 × single; ferry round-trip ticket) and marks the cheaper trip.
- [x] The reference-data API returns the Crossing Fee tables from the database.
- [x] The client fetches reference data, runs the calculator in the browser, and shows both trips in Danish with amounts in DKK, the cheaper one highlighted. The layout is mobile-first.
- [x] A Vitest test of the calculator through its public function covers the bridge and ferry fees and which trip is cheaper.
- [x] A Vitest server test seeds a test database and checks the reference-data API response.
- [x] A Playwright smoke test against the running app checks that the page shows two Shopping Trips with exactly one highlighted.

## Comments

Built (all acceptance criteria met):

- npm workspaces `shared` (calculator + types, `calculateTrips(inputs, reference)`), `server` (Hono + Drizzle/better-sqlite3, migrations in `server/drizzle`, seed JSON in `server/seed`), `client` (React + Vite), plus root `e2e/` Playwright test.
- Commands: `npm run dev` (server on :3001, client on :5173, Vite proxies `/api`), `npm run seed` (deletes and recreates `data/shop-in-sweden.db`; run once before first `dev`), `npm test` (Vitest + Playwright), `npm run test:unit`, `npm run test:e2e`, `npm run typecheck`. After editing `server/src/db/schema.ts`: `npm run db:generate -w server`.
- Playwright runs on its own ports (5174/3101) and DB (`data/e2e.db`), seeding itself; it needs `npx playwright install chromium` once.

Notes for later tickets:

- `TripInputs` is empty and `CrossingFeeKind` is only `single | round-trip`; tickets 03+ extend these and the `crossing_fees` table (season, agreement, bracket columns).
- Calculator ties go to the first Crossing in the reference data (bridge), so exactly one trip is always highlighted.
- Bridge fee valid-from is 2026-09-14 (the spec's price-change date); ferry valid-from 2026-01-01 is a placeholder, since the researched date was only 2026-10-08. Verify both.
- The reference-data API does not yet take a Trip Date.
