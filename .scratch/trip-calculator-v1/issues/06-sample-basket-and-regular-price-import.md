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

- [ ] Seed data holds:
  - the four Categories: groceries, candy and snacks, soft drinks, and personal care and household
  - the Danish and Swedish Retailers, and the Swedish Stores per Destination with their external ids (Tjek dealer ids, Willys store ids)
  - the 27 Basket Items agreed in design, each with its Category and Match Rule (Danish and Swedish search words, pack-size range, excluded words such as øko/eko and laktosefri/laktosfri)
- [ ] The import command runs all importers or a named subset, and records each run with its outcome.
- [ ] The Willys and REMA 1000 importers search with each Basket Item's search words and store raw Price Observations: source, Retailer, product text, price, currency, quantity, regular, and import time.
- [ ] The ECB importer stores the SEK→DKK rate with its date and source.
- [ ] Unit Price is computed as price ÷ (pieces × size × unit factor), normalised to per kg, per litre or per piece.
- [ ] Match Rules are applied when prices are evaluated, not stored at import, so editing a rule and re-running the report changes the result without a re-import.
- [ ] The match report prints as described above.
- [ ] Fixtures: record real Willys search, REMA 1000 search and ECB responses, trimmed to what the tests need. An ECB sample is in `research-samples/`.
- [ ] End-to-end server tests replay the fixtures through the import command and assert on:
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
