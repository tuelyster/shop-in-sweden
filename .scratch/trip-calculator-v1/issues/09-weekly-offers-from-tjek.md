# 09: Weekly Offers from Tjek

**What to build:** Price Gaps include this week's **Offers**. The import command gains a Tjek importer that fetches leaflet Offers:

- **Swedish:** for each Store at each Destination.
  - Hyllie: Willys Emporia, City Gross Hyllie, Lidl Delsjögatan
  - Väla: Willys Väla, Stora Coop Väla, Lidl Drottninghögsvägen
- **Danish:** for each Retailer, using Copenhagen-area catalogs: REMA 1000, Netto, Lidl DK, Føtex, Bilka.

ICA is excluded (ADR 0002). Only Offers valid on the Trip Date count. Multi-buys count at their per-unit price. Member-only Offers are stored and flagged but never used.

The Basket Item breakdown shows whether the cheapest price is an Offer, and until when it's valid.

**Blocked by:** 03 (Trip Date), 07 (Price Gaps and Planned Spend)

**Status:** ready-for-agent

- [x] The Tjek importer queries Swedish Stores with Swedish coordinates and Danish Retailers with Danish coordinates, because Tjek returns one country per query. It pages through results (limit 100).
- [x] Each Offer is stored as a Price Observation with heading, description, price, currency, quantity (unit, size, pieces), valid-from and valid-to, Retailer, and Store for Swedish Offers.
- [x] Unit Price uses pieces × size × unit factor, so "2 för 40" and multipacks compare correctly.
- [x] Member-only Offers are recognised from Retailer-specific phrases held in seed data ("För dig med WillysPlus", "Medlemspris", "Lidl Plus", "PRIO-medlemmar"), flagged, and excluded from Price Gaps.
- [x] An Offer counts only when valid-from ≤ Trip Date ≤ valid-to.
- [x] The match report shows Offers picked and rejected, including member-only rejections.
- [x] Fixtures: use the Swedish Tjek samples in `research-samples/`, and record a Danish Tjek offers response.
- [x] Server end-to-end tests cover: an Offer beating the regular price; an expired Offer ignored; a member-only Offer excluded; multi-buy Unit Price; an Offer at a Store outside the Destination not counting.

## Comments

Built (all acceptance criteria met; the criteria above are ticked).

- **Importer:** `server/src/sources/tjek.ts` (`npm run import -- tjek`, source name `tjek`, also part of `npm run import`). Sequential requests with `delayMs` pause. Catalog lists and offers page with `limit=100&offset=…`.
  - **Swedish Stores:** `GET /v2/stores/{tjekStoreId}` gives the Tjek store's name and coordinates; `GET /v2/catalogs?dealer_ids=<dealer>&r_lat&r_lng&r_radius=20000` with those Swedish coordinates; then `GET /v2/offers?catalog_id=…` per catalog. Offers are stored with the Store id.
  - **Which catalogs belong to a Store:** the one whose label equals the Tjek store name ("Willys Malmö Emporia", "Willys Helsingborg Väla", "Stora Coop Väla Hbg"). If there is none (Lidl, City Gross publish national leaflets named "Vecka 41"), the dealer's catalogs whose label does not start with the Retailer's name. A national leaflet is read once per run but stored once per Store of the Retailer, so it counts at both Lidl Stores etc. but never at a Retailer without a Store at the Destination.
  - **Danish Retailers:** catalogs for the Retailer's dealer id near Copenhagen (55.676, 12.568), `observation.storeId = null`.
  - Every catalog still running (valid-to local date ≥ today) with Offers is read, so next week's leaflet is in the database before it starts and a later Trip Date finds it. All Offers with a positive price in SEK/DKK are stored, not only the ones a Basket Item could match (about 5 000 rows a week).
- **Danish Tjek dealer ids** (new nullable `retailers.tjek_dealer_id`, migration `0005_green_storm`): REMA 1000 `11deC`, Netto `9ba51`, Lidl DK `71c90`, Føtex `bdf5A`, Bilka `93f13`. Seeded in `server/seed/retailers.json`. A plain Copenhagen catalogs query (limit 100, 88 hits) does not list Føtex at all; query with `dealer_ids` instead.
- **Size-range rule:** Tjek sizes and piece counts can be ranges (7.5–500 g, 400–500 g). Only an exact value (`from == to`) is used. A range gives the Offer no quantity, and the Match Rule rejects it as "no pack size could be read" instead of pricing it at a guessed size. Unknown unit symbols (`m`, `pair` …) behave the same. Unit Price is the existing price / (pieces × size × unit factor), so "2 för 40" (pieces 2) and multipacks (15 × 33 cl) compare correctly. Live run: 7–35 per leaflet had no readable quantity.
- **Member-only:** phrases per Retailer in `retailers.json`, matched case-insensitively against heading + description, plus a generic "stammis". The live Danish run showed Danish member phrases are needed, so these were added: Netto `Netto+` ("Gælder kun med Netto+ appen"), Føtex `føtex plus`, Bilka `Bilka plus`, Lidl DK `Lidl Plus`. REMA 1000 showed no member-only wording in this week's leaflets (empty list). Member-only Offers are stored with `member_only = 1` and never used.
- **Validity:** `valid-from ≤ Trip Date ≤ valid-to`, comparing local dates (Europe/Copenhagen, `server/src/dates.ts`): `run_from 2026-10-04T22:00Z` is 5 October. Offers are stored with those dates; `selectCandidates(observations, tripDate)` in `match-report.ts` decides at evaluation time (newest import of each Offer id wins, so a corrected Offer replaces the old one). `candidateObservations` and `measurePriceGaps` now take the Trip Date; the API passes `dato`. The CLI uses the coming Saturday (`npm run report -- 2026-10-17` takes a date).
- **Match report:** now prints the Trip Date, marks a picked Offer `[Offer, valid until …]` and lists rejected Offers: `member-only Offer` (shown first so the cap of 8 never hides them) and `Offer valid X to Y, not on Trip Date Z` (only Offers that ended at most 14 days before the Trip Date, to keep the list short).
- **Offers have no search words:** Tjek Offers are not "found by" a search, so for an Offer the search words that count as found are the current ones that appear in its text (evaluated at report time, so Match Rule edits apply without re-import).
- **UI:** the Basket Item breakdown already showed "(tilbud til <date>)" or "(normalpris)" from ticket 07, so no client change was needed.
- **Tests:** `server/test/offers.test.ts` (32 tests, through `/api/reference-data`: Offer beats regular price, expired and not-yet-started Offers, local-time first/last day, member-only (Willys, Coop, Netto), multi-buy and ml→l factor, Offer at a Store outside the Destination, national leaflet per Store, Danish Offers, importer paging/coordinates/sequence, unit tests for quantity, member phrases, catalog choice, local dates). Fixture `server/test/fixtures/tjek.json` is a live recording from 2026-10-08 (six Swedish Stores and five Danish Retailers, Offers trimmed to Basket-Item candidates plus a few member-only ones), replayed by `server/test/tjek-fake.ts`. It was recorded fresh with the importer's own requests (a superset of `research-samples/`, which has one catalog per dealer and no Danish data). The older import and price-gap tests use `noLeaflets` (recorded stores, no leaflets) so they keep testing regular prices.
- **Quirks:** Lidl DK's evergreen "Fast lav pris i Lidl" catalog runs to 31 December, so those items count as Offers all year. Bilka's non-food and toy catalogs are imported too but rarely match. Many Danish Offers carry text such as "Pr. kg 59,80" in the description; the Match Rule sees it but only the Unit Price from pieces × size is used. A Lidl Plus Offer sometimes shows the ordinary and the member price in one text; it is excluded whole.
