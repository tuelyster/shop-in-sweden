# 11: Petrol prices and Fill-up Saving

**What to build:**

- The import command gains an **EU Weekly Oil Bulletin** importer. It fetches Danish and Swedish petrol prices (Euro-super 95, with taxes), which become the default Danish petrol price for Driving Cost.
- Shoppers with a petrol Vehicle can enter how many litres they'd fill up in Sweden. The **Fill-up Saving** counts towards Gross Saving and the Break-even Spend.
- Electric Vehicles don't see the fill-up input.

**Blocked by:** 04 (Vehicle and Driving Cost), 07 (Price Gaps and Planned Spend)

**Status:** done

- [x] The Oil Bulletin importer stores petrol prices per country with date and source.
- [x] The reference-data API returns the latest Danish and Swedish petrol prices. The Danish one replaces the manually seeded default petrol price.
- [x] Fill-up Saving = litres × (Danish petrol price − Swedish petrol price converted to DKK), for petrol Vehicles only.
- [x] Fill-up Saving is included in Gross Saving and in the Break-even Spend.
- [x] The litres input is shown only for petrol Vehicles and is part of the shareable URL.
- [x] Fixture: the Oil Bulletin sample in `research-samples/`. The Swedish petrol figure looked suspicious during research, so check it when parsing.
- [x] A server end-to-end test covers the importer and the API output. Calculator tests cover Fill-up Saving for petrol, none for electric, and its effect on break-even.

## Comments

- **Source and format:** the bulletin page https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en links an xlsx "prices with taxes latest prices" through `/document/download/<uuid>_en?filename=...`. The uuid changes, and the filename date in the link lagged behind the content (link said 2026-09-21, the sheet is dated 2026-10-05), so the importer finds the link on the page (href containing `with%20Taxes` and `.xlsx`, not the "without taxes" one) on every run. No CSV/JSON variant exists. Parsed with `read-excel-file` (maintained, pure JS, no native build); code in `server/src/sources/oil.ts`.
- **Sheet layout:** one sheet. Row 1 headings (`Euro-super 95  (I)` in column B), row 2 the units (A2 is the reference date, B2 is `1000 l`), then one row per country. So prices are EUR per 1000 L; the importer checks the unit cell and a 0.5 to 4 EUR/L plausibility bound, and fails loudly otherwise. Divide by 1000, then multiply by the ECB's DKK or SEK per EUR (the importer fetches the ECB rates itself, so `oil` fails if the ECB is down).
- **Swedish petrol anomaly, finding:** no parsing error. Sweden's row is aligned (column B, unit `1000 l`, same as every other country); Euro-super 95 = 1589.34 EUR/1000 L = 1.589 EUR/L = about 17.84 SEK/L at 11.224, within about 3 % of the March 2026 report (18.44 SEK/L) once prices and exchange rate move. The live workbook (re-downloaded 2026-10-08, same reference date) has an identical Swedish figure. What looks odd is real in the data: Swedish diesel (2.118 EUR/L, about 23.8 SEK/L) is 0.53 EUR/L dearer than petrol, a much wider diesel premium than in other countries (typically 0.1 to 0.3), and Denmark's petrol (2.605 EUR/L) is 1.0 EUR/L above Sweden's. I could not independently confirm the Swedish figure (a web search found no October 2026 price), so it is taken as published; the Fill-up Saving it implies is large (about 7.6 DKK/L), so spot check it against a Swedish pump price before launch.
- **Storage:** new table `petrol_prices` (migration 0004): country, price per litre in local currency, currency, price in EUR as published, bulletin date, source, imported-at. Rows are only added.
- **Reference data:** `petrolPrices: { denmark, sweden }` (latest by date, null when never imported). The petrol Vehicle default's price, source and date are replaced by the imported Danish price when one exists; with no import the seeded 19.5 DKK/L stays.
- **Decision, which Danish price in the Fill-up Saving:** the same one Driving Cost uses, i.e. the shopper's petrol price override if they entered one, otherwise the default (imported once available). Rationale: the shopper's own figure is their real alternative at the pump. If Sweden's price or the exchange rate is missing the Fill-up Saving is 0 (unknown), not an error. Negative values are shown as they are.
- **Calculator/UI:** `fillUpSavingDkk` on each trip result, included in `grossSavingDkk` and `breakEven`. Gross Saving label changed to "Besparelse (brutto)" with a "heraf billigere benzin" line when litres are entered. Input `liter` (default 0), shown only for petrol: "Liter benzin du tanker i Sverige".
- **Live prices:** the ECB API was down during the first run. After the rebase, `npm run import -- ecb oil` succeeded on 2026-10-08. It stored bulletin date 2026-10-05: Denmark 19.47 DKK/L and Sweden 17.84 SEK/L. At 1 SEK = 0.66594 DKK, the Swedish price is about 11.88 DKK/L, which gives a Fill-up Saving of about 7.59 DKK per litre.
