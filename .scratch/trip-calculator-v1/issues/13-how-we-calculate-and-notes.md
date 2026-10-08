# 13: "How we calculate" page and notes

**What to build:** A Danish "How we calculate" page explains the method and its limits, so a shopper can judge whether to trust the numbers. It covers:

- the Sample Basket and how Basket Items are matched
- cheapest prices at the Destination's Stores vs Danish Retailers
- Offers, and why member-only prices are left out
- Lost Deposit and the exchange rate
- the Crossing Fees and Discount Agreements
- the data sources, and that imports are manual
- why ICA, alcohol, meat and snus are left out
- the temporary Swedish food VAT cut (until 31 December 2027)

The calculator page also gains two short notes:

- "alcohol and meat are dearer in Sweden"
- "ferry Lavpris tickets from 199 kr one way exist if you book early"

**Blocked by:** 09 (Weekly Offers), 10 (Lost Deposit), 11 (Petrol prices and Fill-up Saving)

**Status:** done

- [x] A "How we calculate" page in Danish, reachable from the calculator, covering the points above in the language of `CONTEXT.md`.
- [x] The alcohol-and-meat note and the Lavpris note appear on the calculator page.
- [x] Source attributions match the sources the reference-data API reports.
- [x] The page credits GeoNames (CC BY 4.0) for postcode centre points and OpenStreetMap/OSRM for road distances, as their licences require (see ticket 05), and explains that the 31 island postcodes without a road link must enter their distance by hand.
- [x] The Playwright smoke test checks that the page is reachable.

## Comments

Built (all criteria met).

- **Routing:** no router. The page is a second view of the same `App`, chosen by the hash `#/saadan-regner-vi`. `App` keeps all hooks, so inputs and query string survive both ways (`useUrlInputs` already preserves the hash). Links: "Sådan regner vi" on the calculator, "Tilbage til beregneren" (href `#`) on the page. Opening the hash URL directly works.
- **Page:** `client/src/HowWeCalculate.tsx`, Danish prose with one fixed Danish word per glossary term (indkøbstur, overfart, destination, overfartspris, rabataftale, kørselsudgift, prisforskel, prøvekurv, kurvvare, enhedspris, tilbud, tabt pant, bruttobesparelse, nettobesparelse, break-even indkøb), plus a glossary at the bottom. No live numbers in the prose; only fixed rules (14 days, 2/3 SEK deposit, 31 Dec 2027, 199 kr).
- **Attributions:** the list "Kilder, som vores data opgiver" is rendered from reference data (Crossing Fee, season, Vehicle default, petrol and exchange-rate `source` strings, de-duplicated). The Lost Deposit source (Pantamera) is not in the reference-data API, so it is in the static credits. GeoNames (CC BY 4.0) and OSRM/OpenStreetMap contributors (ODbL) are linked; the 31 island postcodes are explained.
- **Calculator notes:** the alcohol/meat note sits under Planned Spend; the Lavpris note sits in the ferry trip card.
- **Test:** `e2e/smoke.spec.ts`, "the Sådan regner vi page is reachable and back, with inputs intact".
