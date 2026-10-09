# Shop in Sweden

A Danish website that tells people in Denmark whether a car trip to Sweden to shop pays off. It weighs the saving on the goods against the cost of the trip: the bridge or ferry, plus fuel or electricity.

For each Crossing (Øresund Bridge to Hyllie/Emporia, Helsingør–Helsingborg ferry to Väla Centrum), the site shows:

- the Crossing Fee
- the Driving Cost
- the Gross Saving and Net Saving
- the Break-even Spend

The cheaper trip is highlighted. Price Gaps are measured on our own Sample Basket, using real regular prices and this week's Offers.

- Domain language: [CONTEXT.md](CONTEXT.md)
- Decisions: [docs/adr/](docs/adr/)
- Spec and tickets: [.scratch/trip-calculator-v1/](.scratch/trip-calculator-v1/)

## Requirements

- Node.js 22 or newer and npm 10
- Internet access, for imports and for building the distance table

## Getting started

```sh
npm install
npm run seed      # create the database from the seed files
npm run import    # fetch prices, exchange rate and petrol prices (takes a few minutes)
npm run dev       # start server and client
```

Open http://localhost:5173.

**If `npm install` fails on `better-sqlite3`:** this happens on machines without C++ build tools, such as Windows without Visual Studio. Install with `npm install --ignore-scripts`. The prebuilt SQLite binary still works.

The page works without imported prices. It shows the Crossing Fees and Driving Cost, and marks Price Gaps as "ingen prisdata endnu".

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API server and the client. Both reload on change. |
| `npm run seed` | **Deletes** and recreates the database from `server/seed/`. Stored prices are lost, so run `npm run import` afterwards. |
| `npm run import` | Fetches from all sources, then prints the match report. |
| `npm run import -- <source> …` | Fetches only the named sources (see below). |
| `npm run import -- --help` | Shows the import usage. |
| `npm run report` | Prints the match report from stored prices without fetching, for the coming Saturday. |
| `npm run report -- 2026-10-17` | Prints the match report for another Trip Date. |
| `npm test` | Runs the unit tests, then the browser tests. |
| `npm run test:unit` | Runs the Vitest tests (shared, server, client). |
| `npm run test:e2e` | Runs the Playwright tests. They start their own server, client and database. |
| `npm run typecheck` | Type-checks all packages. |

**Stop `npm run dev` before `npm run seed`.** On Windows the running server keeps the database file open, and the seed fails with `EBUSY`.

## Importing prices

Imports are always run by hand, and nothing runs on a schedule. Each run adds Price Observations and never overwrites old ones, so price history is kept.

| Source | What it fetches |
|---|---|
| `willys` | Regular prices from Willys (Sweden), searched with each Basket Item's Swedish search words. |
| `rema` | Regular prices from REMA 1000 (Denmark). The API ignores search terms, so the importer pages through the whole webshop and filters locally. |
| `ecb` | The SEK→DKK exchange rate from the ECB. |
| `oil` | Danish and Swedish petrol prices (Euro-super 95, with taxes) from the EU Weekly Oil Bulletin. It needs the ECB to be reachable. |
| `tjek` | This week's and next week's leaflet Offers from Tjek, for the Swedish Stores at each Destination and for the Danish Retailers. |

Examples:

```sh
npm run import                 # everything
npm run import -- ecb oil      # only exchange rate and petrol
npm run import -- tjek         # only Offers
```

Importers are isolated. If one fails, the others still run, the summary marks it `FAILED`, and the command exits with code 1.

Re-run the import at least weekly. After 14 days the page warns that prices are stale.

All sources are unofficial or undocumented endpoints ([ADR 0002](docs/adr/0002-prices-from-unofficial-retailer-and-tjek-endpoints.md)). They can change without notice. Check their terms of use before the site goes public.

## Tuning the Sample Basket (Match Rules)

The Basket Items and their Match Rules are in `server/seed/basket.json`. A Match Rule decides which products count as, for example, "whole milk". It holds:

- search words per country
- name words
- excluded words, such as `øko` / `eko`
- unit (`kg`, `l`, `pcs`)
- pack-size range

The tuning loop:

1. Run `npm run report`. For each Basket Item and country, the report shows which product was picked as cheapest and which were rejected, and why.
2. Edit `server/seed/basket.json`.
3. Run `npm run report` again. Removing words, size ranges and excluded words take effect without a new import. **New Swedish search words** need `npm run import -- willys` to fetch the new products.

Retailers, Stores, Tjek dealer ids and the member-offer phrases are in `server/seed/retailers.json`. Member-only Offers are recognised from those phrases and never counted.

## Seed data

Everything entered by hand lives in `server/seed/` and is loaded by `npm run seed`:

| File | Contents |
|---|---|
| `crossings.json` | The two Crossings and their Destinations |
| `crossing-fees.json` | Crossing Fees and Discount Agreement prices, with the date each applies from and its source |
| `seasons.json` | Ferry high season (1 June – 31 August) |
| `vehicle-defaults.json` | Default consumption and energy prices for petrol and electric cars |
| `basket.json` | Categories, Basket Items and Match Rules |
| `retailers.json` | Retailers, Stores per Destination, external ids, member-offer phrases |
| `lost-deposits.json` | Swedish deposit per container (2 SEK up to 1 L, 3 SEK above) |
| `postcode-distances.json` | Generated road distance from each Danish postcode to each Destination |

When a price changes, such as a new bridge fee, add a new entry with its own valid-from date and source. Don't overwrite the old one. Then run `npm run seed` followed by `npm run import`.

### Rebuilding the postcode distance table

```sh
npm run distances:build -w server
```

This is rarely needed. The script takes postcode centre points from GeoNames and routes each one to the Destinations with the public OSRM server. A full run takes about 45 minutes. It resumes from `data/postcode-routes-cache.json`; delete that file to route everything again. The 31 island postcodes with no road link are left out, and those shoppers enter their distance by hand.

## Configuration

| Variable | Default | Used by |
|---|---|---|
| `DATABASE_PATH` | `data/shop-in-sweden.db` | server, seed, import |
| `PORT` | `3001` | API server |
| `API_PORT` | `3001` | Client dev proxy (where `/api` is forwarded) |
| `CLIENT_PORT` | `5173` | Client dev server |
| `E2E_CLIENT_PORT` | `5174` | Playwright |
| `E2E_API_PORT` | `3101` | Playwright |
| `E2E_DATABASE_PATH` | `data/e2e.db` | Playwright |

The `data/` folder is gitignored.

## Shareable URLs

Every input is kept in the page URL, so a result can be shared by copying the link. The last inputs are also restored from the browser on the next visit.

| Parameter | Meaning |
|---|---|
| `dato` | Trip Date, `YYYY-MM-DD` (default: next Saturday) |
| `postnr` | Starting Point postcode |
| `km-bro`, `km-faerge` | Manual one-way distance to Hyllie or Väla; overrides the postcode |
| `energi` | `benzin` or `el` |
| `forbrug`, `energipris` | Consumption per 100 km and energy price, overriding the defaults |
| `oresundgo`, `autobizz` | `1` if the shopper has that Discount Agreement |
| `turkort` | Multi-trip card bracket: `3-9`, `10-19`, `20-34`, `35+` or `ingen` |
| `kr-dagligvarer`, `kr-slik`, `kr-sodavand`, `kr-pleje` | Planned Spend per Category, in DKK at Danish prices |
| `liter` | Litres of petrol filled up in Sweden |

The "Sådan regner vi" page, which explains the method and credits the data sources, is at `#/saadan-regner-vi`.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/reference-data?dato=YYYY-MM-DD` | Crossing Fees for the date, seasons, Vehicle defaults, petrol prices, exchange rate, Price Gaps per Destination and Category with a per-Basket Item breakdown, and data freshness |
| `GET /api/postcodes/:postcode/distances` | `{ postcode, name, distanceKm: { bridge, ferry } }`. Answers `400 malformed-postcode` or `404 unknown-postcode` when the postcode can't be looked up. |

## Project layout

```text
client/   React + Vite UI (Danish). The calculator runs in the browser.
server/   Hono API, Drizzle + SQLite, importers, seed files, migrations
shared/   Pure TypeScript: the calculator, Unit Price, shared types
e2e/      Playwright browser tests
```

After changing `server/src/db/schema.ts`, generate a migration with `npm run db:generate -w server`.

## Known limitations

- The app only runs locally; there is no deployment yet ([ADR 0001](docs/adr/0001-node-backend-with-database.md)).
- The Match Rules are a first pass. Some Basket Items match the wrong products, so check the match report before trusting the Price Gaps.
- The default electricity price (2.50 kr/kWh) is an estimate.
- Some valid-from dates in `crossing-fees.json` are placeholders.
- ICA, member prices, alcohol, meat and snus are left out on purpose. The "Sådan regner vi" page explains why.
