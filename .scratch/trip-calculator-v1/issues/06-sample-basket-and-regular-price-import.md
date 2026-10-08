# 06: Sample Basket and the regular-price import

**What to build:** The maintainer can run a manual import command that fetches:

- regular prices for every Basket Item from **Willys** (Sweden) and **REMA 1000** (Denmark)
- the latest SEK/DKK exchange rate from the **ECB**

Every result is stored as a Price Observation and never overwritten. The command finishes by printing a **match report**:

- per Basket Item and country, which product was picked as the cheapest by Unit Price
- which candidates were rejected by the Match Rules, and why
- which Basket Items have no price in a country

Importers are isolated: one failing is reported, and the rest still run. See ADR 0002 and the spec's "Importers", "Price Gap measurement" (Unit Price, matching at calculation time) and "Seed data" sections.

**Blocked by:** 01 (Walking skeleton)

**Status:** ready-for-agent

- [x] Seed data holds:
  - the four Categories: groceries, candy and snacks, soft drinks, and personal care and household
  - the Danish and Swedish Retailers, and the Swedish Stores per Destination with their external ids (Tjek dealer ids, Willys store ids)
  - the 27 Basket Items agreed in design, each with its Category and Match Rule (Danish and Swedish search words, pack-size range, excluded words such as øko/eko and laktosefri/laktosfri)
- [x] The import command runs all importers or a named subset, and records each run with its outcome.
- [x] The Willys and REMA 1000 importers search with each Basket Item's search words and store raw Price Observations: source, Retailer, product text, price, currency, quantity, regular, and import time.
- [x] The ECB importer stores the SEK→DKK rate with its date and source.
- [x] Unit Price is computed as price ÷ (pieces × size × unit factor), normalised to per kg, per litre or per piece.
- [x] Match Rules are applied when prices are evaluated, not stored at import, so editing a rule and re-running the report changes the result without a re-import.
- [x] The match report prints as described above.
- [x] Fixtures: record real Willys search, REMA 1000 search and ECB responses, trimmed to what the tests need. An ECB sample is in `research-samples/`.
- [x] End-to-end server tests replay the fixtures through the import command and assert on:
  - the match report
  - the stored observations, through the public interface rather than table layout
  - a rule edit taking effect without re-import
  - one importer failing while the others succeed

## The 27 Basket Items (Danish / Swedish search words)

| Category | Basket Item | Danish | Swedish |
|---|---|---|---|
| Groceries | Whole milk | sødmælk | standardmjölk |
| | Butter | smør | smör |
| | Eggs (each) | æg | ägg |
| | Sliced cheese | skæreost | hushållsost |
| | Toast bread | toastbrød | rostbröd |
| | Spaghetti | spaghetti | spaghetti |
| | Rice | ris | ris |
| | Ground coffee | formalet kaffe | bryggkaffe |
| | Minced beef | hakket oksekød | nötfärs |
| | Chicken breast | kyllingebryst | kycklingfilé |
| Candy and snacks | Milk chocolate bar | mælkechokolade | mjölkchoklad |
| | Pick-and-mix candy | bland selv slik | lösgodis |
| | Bagged candy | slik pose / vingummi | godispåse |
| | Potato crisps | chips | chips |
| | Salted peanuts | saltede peanuts | jordnötter |
| | Biscuits | kiks | kex |
| Soft drinks | Cola 1.5 L | cola 1,5 l | cola 1,5 l |
| | Cola cans | cola dåse | cola burk |
| | Sparkling water | danskvand | kolsyrat vatten |
| | Energy drink | energidrik | energidryck |
| | Orange juice | appelsinjuice | apelsinjuice |
| Personal care and household | Shampoo | shampoo | schampo |
| | Toothpaste | tandpasta | tandkräm |
| | Deodorant | deodorant | deodorant |
| | Diapers | bleer | blöjor |
| | Laundry detergent | vaskemiddel | tvättmedel |
| | Toilet paper | toiletpapir | toalettpapper |

## Comments

Built (all acceptance criteria met):

- **Seed:** `server/seed/basket.json` (4 Categories, 27 Basket Items, each with a Match Rule) and `server/seed/retailers.json` (5 Danish and 4 Swedish Retailers, the 6 Swedish Stores with Tjek dealer/store ids, Willys store ids 2244 Emporia and 2271 Väla, and member-offer phrases for ticket 09). New tables: categories, retailers, stores, basket_items, price_observations, exchange_rates, import_runs (migration `0003`, renumbered when rebased onto tickets 03–04).
- **Commands:** `npm run seed` (fresh DB, as before), `npm run import` (all importers) or `npm run import -- willys rema` (named subset; names are `willys`, `rema`, `ecb`), then the match report is printed. `npm run report` prints the report from stored prices without fetching and first re-syncs Retailers, Stores and Basket Items from the seed files, so a Match Rule edit shows up without a re-import. Exit code is 1 if any importer failed.
- **Unit Price** lives in `shared` (`unitPrice`, `totalContent`) with tests; Match Rule evaluation is in `server/src/match/`.
- **Match Rule shape:** `searchWords` per country, optional `nameWords` per country, `excludedWords` per country, `unit` (kg/l/pcs), `packSize` (total content range), optional `pieces` and `itemSize` ranges. Danish products are found by text (all words of a search word or name word in the product text). Swedish products by default only have to have been returned by one of the Basket Item's current search words, because Willys searches its own catalogue. `nameWords: []` or omitted on SE means "returned by a current search word"; set `nameWords.SE` where Willys search is fuzzy (cola, rice, eggs, butter, biscuits). Adding a new Swedish search word still needs a re-import to find products; removing words, size ranges and excluded words take effect immediately.
- **Tests:** `server/test/import.test.ts` replays recorded fixtures (`server/test/fixtures/`: trimmed Willys search results, a REMA 1000 products page, the live ECB CSV) through the import command via an injected `fetch`. Covers match report picks and rejects, Unit Price (multipack, weight, count, rolls), stored observations, never-overwrite, one request per Swedish search word, rule edit without re-import, failing importer isolation, run records, subset selection, unknown source.

Flagged:

- **REMA 1000 search does not search.** `api.digital.rema1000.dk/api/v3/products?search=...` (and `q`, `query`, `name`, `keyword`) is ignored and returns the whole catalogue (about 3950 products, 20 per page, `per_page=100` works, ~40 pages). The REMA importer therefore pages through the catalogue and searches locally with the Danish search words and name words, storing only products that look relevant to some Basket Item (~320). The catalogue is REMA's webshop range only, so some Basket Items have no Danish price ("Pick-and-mix candy" has none, which is expected).
- Willys search: `Accept: application/json` on `/search?q=...&size=100&page=0` (page is 0-based; default page size is 10). Multi-word queries behave like OR ("cola 1,5 l" also returns milk in 1,5 l). `priceValue` is the regular shelf price; campaigns are separate in `potentialPromotions` (not used here). `depositPrice` is a text for the whole pack ("30,00 kr" for 15 cans), stored as raw `deposit` for ticket 10. Pack size comes from `displayVolume` ("1,5l", "15p/33cl", "ca: 2.2kg", "24p", "st"). Eko is only in the `labels` (`ecological`) and sometimes in the name, so labels are appended to the product text. Up to 3 pages (300 hits) are read per search word.
- REMA: `prices` is a list; the importer uses the non-campaign price in force today (campaign prices are Offers, ticket 09). Pack size is in `underline` ("1 LTR. / ARLA", "500 GR."); labels (`Økologi`, `Laktose fri`) are appended to the text. Toilet paper is sized in grams but counted in rolls ("8 RULLER"), so rolls are read from the text; some toilet paper has no roll count and is rejected as "no pack size".
- **Rules are a first pass.** After one live tuning round (2026-10-08) most picks look right, but some are questionable and will need maintainer tuning from the report: Potato crisps SE picks "Salta Pinnar" (pretzel sticks), Sliced cheese SE picks a 1.2 kg block of hushållsost, Toast bread SE and Minced beef SE (20% Irish, 1 kg) are plausible but loose, Deodorant SE picks a spray, Diapers compare per piece across different sizes. Danish Cola cans picks a single 50 cl bottle (the 33 cl cans are not in REMA's webshop range in the fixture).
- ECB: `D.SEK+DKK.EUR.SP00.A?format=csvdata&lastNObservations=1` returns one row per currency; SEK→DKK = DKK per EUR / SEK per EUR (0.6659 on 2026-10-07).
- Willys regular prices are stored per Retailer (no Store), as the spec says they count at every Willys Store.

Live run on 2026-10-08 (fresh DB): willys 1768 stored, rema 323 stored, ecb 1 stored. Excerpt:

```
Exchange rate: 1 SEK = 0.6659 DKK (ECB euro foreign exchange reference rates, 2026-10-07)
  Whole milk
    Denmark: PICKED REMA 1000: SØDMÆLK 3,5% | 1 LTR. / ARLA [Bedre dyrevelfærd 2, Dansk]
      13.50 DKK for 1 l = 13.50 DKK/l  (cheapest of 1 accepted)
      rejected REMA 1000: SØDMÆLK 3,5% | 0.5 LTR. / ARLA [Dansk] (7.95 DKK): pack size 0.5 l outside 0.9-2.1 l
    Sweden: PICKED Willys: Mjölk Längre Hållbarhet 3% | GARANT, 1,5l
      16.90 SEK for 1.5 l = 11.27 SEK/l = 7.50 DKK/l  (cheapest of 8 accepted)
      rejected Willys: Mjölk Eko 3% | ARLA KO, 3dl [Eko] (6.90 SEK): excluded word "eko"
```
