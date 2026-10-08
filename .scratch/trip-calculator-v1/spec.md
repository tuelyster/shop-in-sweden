Status: ready-for-agent

# Spec: Shopping Trip calculator v1

Terms in **bold** are defined in `CONTEXT.md`. Background decisions: `docs/adr/0001-node-backend-with-database.md` and `docs/adr/0002-prices-from-unofficial-retailer-and-tjek-endpoints.md`.

## Problem Statement

People living in Denmark hear that "everything is cheaper in Sweden" and consider driving over to shop. They have no easy way to know whether a trip actually pays off once the bridge or ferry and the drive are paid for. The price differences vary by type of goods, by store and from week to week with offers, and some goods (meat, alcohol) are actually dearer in Sweden. The two **Crossings** cost very different amounts, and the answer depends on where you live, what car you drive, which discount agreements you already have, and how much you plan to buy. Today people guess, or rely on marketing claims like "save up to 30%".

## Solution

A Danish-language website where a shopper enters:

- where they drive from (postcode)
- when they plan to go
- their car
- any **Discount Agreement** they already have
- roughly how much they'd spend at Danish prices in each of four **Categories**
- optionally, how many litres of petrol they'd fill up in Sweden

The site calculates a **Shopping Trip** for each Crossing (Øresund Bridge to Hyllie/Emporia, Helsingør–Helsingborg ferry to Väla Centrum). For each it shows the **Net Saving** and the **Break-even Spend**, and highlights the cheaper trip.

The **Price Gaps** behind the numbers come from our own **Sample Basket**. It is priced from real regular prices and current weekly **Offers** at the Swedish **Stores** at each **Destination** and at the main Danish discount **Retailers**. The site always shows how fresh the data is.

## User Stories

### Entering the trip

1. As a shopper, I want to enter my Danish postcode as my **Starting Point**, so that the driving distance to each Crossing is worked out for me.
2. As a shopper, I want to override the driving distance with my own number of kilometres, so that I get a correct result when I know better than the postcode estimate.
3. As a shopper, I want to be told clearly when the postcode I typed doesn't exist, so that I don't get a result based on nothing.
4. As a shopper, I want to pick the **Trip Date**, defaulting to the next Saturday, so that the calculation uses the Offers and ferry prices that apply on the day I go.
5. As a shopper, I want to say whether my **Vehicle** runs on petrol or electricity, so that the **Driving Cost** uses the right energy.
6. As a shopper, I want sensible default consumption and energy prices for my car type, so that I get a result without knowing technical figures.
7. As a shopper, I want to edit consumption and energy price under an "Advanced" section, so that the Driving Cost matches my own car and tariff.
8. As a shopper with ØresundGO, I want to tick that I have it, so that the bridge **Crossing Fee** uses my discounted per-trip price.
9. As a shopper with AutoBizz, I want to tick that I have it, so that the ferry Crossing Fee uses my AutoBizz price for the right season.
10. As a shopper with a ferry multi-trip card (turkort), I want to pick which trip bracket my card belongs to, so that the ferry Crossing Fee uses my actual per-trip price.
11. As a shopper, I want to enter my **Planned Spend** in DKK at Danish prices for groceries, candy and snacks, soft drinks, and personal care and household, so that the saving reflects my actual shopping.
12. As a shopper, I want to see a short note that alcohol and meat are dearer in Sweden, so that I don't plan a trip around them.
13. As a petrol driver, I want to enter how many litres I'd fill up in Sweden, so that the **Fill-up Saving** counts towards the trip.
14. As an electric-car driver, I don't want to be offered the fill-up option, so that the form only shows what applies to me.

### Seeing the result

15. As a shopper, I want to see the Net Saving for the bridge trip and for the ferry trip side by side, so that I can tell which way to go.
16. As a shopper, I want the cheaper Shopping Trip clearly highlighted, so that I get a recommendation at a glance.
17. As a shopper, I want to see each trip broken down into Crossing Fee, Driving Cost, **Gross Saving** and Fill-up Saving, so that I understand where the number comes from.
18. As a shopper, I want to see the Break-even Spend for each trip, so that I know how much I'd need to buy for the trip to pay off.
19. As a shopper whose shopping mix can never pay for the trip, I want to be told so plainly instead of seeing a meaningless break-even number, so that I'm not misled.
20. As a shopper, I want a negative Net Saving shown honestly as a loss ("you lose 240 kr"), so that I can decide not to go.
21. As a shopper, I want the result to update instantly as I change inputs, so that I can try out different shopping amounts.
22. As a shopper, I want to see the Price Gap for each Category at each Destination, so that I know which goods are worth buying in Sweden.
23. As a curious shopper, I want to expand a Category and see its **Basket Items** with the cheapest Swedish and Danish **Unit Prices**, and whether each came from an Offer, so that I can trust the comparison.
24. As a shopper, I want to see the exchange rate used and its date, so that I understand how Swedish prices were converted.
25. As a shopper, I want to see when prices were last updated, so that I know how current the result is.
26. As a shopper, I want a visible warning when the newest price data is more than 14 days old, so that I treat the result with care.
27. As a shopper, I want a "How we calculate" explanation in Danish, covering the Sample Basket, Offers, **Lost Deposit**, excluded member prices and the data sources, so that I can judge whether to trust the numbers.
28. As a shopper, I want to see that cheaper ferry tickets (Lavpris, from 199 kr one way) exist when booked early, so that I know the ferry can be cheaper than calculated.

### Sharing and returning

29. As a shopper, I want my inputs encoded in the page URL, so that I can send the result to my partner or friends.
30. As someone opening a shared link, I want to see the same inputs and result, so that we're discussing the same numbers.
31. As a returning shopper, I want my last inputs restored when I come back, so that I don't have to type them again.
32. As a shopper on a phone, I want the page designed for a small screen first, so that I can check it on the go.

### Maintaining the data (the maintainer)

33. As the maintainer, I want to run an import command by hand, so that I control when data is fetched from unofficial sources.
34. As the maintainer, I want to import regular prices from Willys and REMA 1000 for every Basket Item, so that each Basket Item has a baseline price in both countries.
35. As the maintainer, I want to import current Offers from Tjek for each Swedish Store at each Destination and for the Danish Retailers, so that the Price Gaps reflect this week's offers.
36. As the maintainer, I want to import the latest SEK/DKK exchange rate from the ECB, so that Swedish prices are converted at a current rate.
37. As the maintainer, I want to import Danish and Swedish petrol prices from the EU Weekly Oil Bulletin, so that the default Driving Cost and the Fill-up Saving are current.
38. As the maintainer, I want every imported price kept as a **Price Observation** with its date, validity and source, never overwritten, so that I can see price history and trace any number.
39. As the maintainer, I want member-only Offers recognised and left out, using phrases per Retailer, so that member prices never make Sweden look cheaper than it is.
40. As the maintainer, I want multi-buy Offers ("2 för 40 kr") converted to their per-unit price, so that they compare fairly.
41. As the maintainer, I want every import to print a match report showing which product was picked as the cheapest for each Basket Item in each country and at each Destination, and which products were rejected and why, so that I can spot wrong matches.
42. As the maintainer, I want to edit **Match Rules** (search words, pack-size range, excluded words) in a seed file and see the effect without re-importing, so that fixing a bad match is quick.
43. As the maintainer, I want the match report to flag Basket Items with no price in one country, so that I can fix the rule or accept the gap.
44. As the maintainer, I want Crossing Fees, Discount Agreement prices, ferry seasons, Stores, Retailers, the Sample Basket, Lost Deposit amounts and the default electricity price kept in seed files in git, so that changes are reviewed and versioned.
45. As the maintainer, I want a single command that loads the seed files into the database, so that a fresh setup is one step.
46. As the maintainer, I want each Crossing Fee to carry the date it applies from and its source, so that I can record price changes such as the bridge's September 2026 change.
47. As the maintainer, I want the postcode-to-Destination distance table generated once by a script and stored in the database, so that the site needs no routing service at runtime.
48. As the maintainer, I want an import of one source to fail loudly without breaking the others, so that one changed endpoint doesn't block the rest.
49. As the maintainer, I want to run the whole app locally with one command, so that I can work on it easily.

## Implementation Decisions

### Shape

- A single repository with three workspace packages: **client** (React + TypeScript + Vite), **server** (Node.js + TypeScript) and **shared** (pure TypeScript used by both). See ADR 0001.
- The server uses SQLite through Drizzle. The schema should stay portable to PostgreSQL.
- The UI is in Danish, and all amounts shown are in DKK. There are no analytics or cookies.
- Nothing is deployed in v1. Everything runs locally.

### Shared calculator module (seam 1)

- One public pure function. It takes trip inputs and reference data, and returns a comparison of the two Shopping Trips.
- **Trip inputs:**
  - Starting Point distances per Destination, from the postcode table or a manual override
  - Trip Date
  - Vehicle: energy type, consumption per 100 km, and energy price per litre or kWh
  - Discount Agreements: ØresundGO yes/no, AutoBizz yes/no, and multi-trip card bracket or none
  - Planned Spend per Category
  - Fill-up litres
- **Reference data:**
  - Price Gaps per Destination per Category
  - Crossing Fee tables with seasons
  - Danish and Swedish petrol prices
  - Exchange rate
- **Output per Shopping Trip:** Crossing Fee, Driving Cost, Gross Saving, Fill-up Saving, **Trip Cost**, Net Saving, and Break-even Spend (or "never pays off"). The whole result also marks which trip is cheaper.
- **Rules:**
  - Crossing Fee, bridge: 2 × the online ticket price, or 2 × the ØresundGO per-trip price.
  - Crossing Fee, ferry: the same-day round-trip ticket for the season the Trip Date falls in. With AutoBizz, 2 × the AutoBizz single price for that season. With a multi-trip card, 2 × the per-trip price for its bracket.
  - Annual fees for Discount Agreements are not counted.
  - Driving Cost = 2 × one-way distance × consumption / 100 × energy price. The distance is the road distance from the Starting Point to the Destination via the Crossing, excluding the ferry leg.
  - Fill-up Saving = litres × (Danish petrol price − Swedish petrol price converted to DKK). It applies to petrol Vehicles only.
  - Gross Saving = Σ over Categories of Planned Spend × Price Gap at that Destination, plus Fill-up Saving.
  - Net Saving = Gross Saving − Trip Cost.
  - Break-even Spend = (Trip Cost − Fill-up Saving) ÷ the spend-weighted average Price Gap.
    - When no spend is entered, Categories are weighted equally.
    - If Fill-up Saving alone covers the Trip Cost, the break-even is 0.
    - If the weighted gap is zero or negative, the result is "never pays off".
- **Rounding:** amounts are rounded only for display, never in intermediate steps.

### Price Gap measurement (server side, behind the reference-data API)

- **Inputs:** Price Observations, the Sample Basket with Match Rules, the Stores per Destination, the Danish Retailers, the Trip Date, the latest exchange rate, and the Lost Deposit amounts.
- **Candidates:** for each Basket Item, take the regular-price observations plus the Offers valid on the Trip Date (valid-from ≤ Trip Date ≤ valid-to). Exclude member-only Offers.
- **Matching:** Match Rules are applied when the gap is calculated, not stored at import time. So editing a rule takes effect without a re-import.
- **Regular prices:** the most recent regular-price observation per product counts.
- **Unit Price** = price ÷ (pieces × size × unit factor), normalised to per kg, per litre or per piece. For a multi-buy, pieces is the required quantity.
- **Lost Deposit:** for soft drinks in Sweden, add the deposit per container × number of containers to the price before computing the Unit Price. Danish prices exclude deposit.
- **Per Basket Item at a Destination:** compare the cheapest Swedish Unit Price among that Destination's Stores (converted to DKK) with the cheapest Danish Unit Price among all Danish Retailers.
  - item gap = 1 − (Swedish DKK Unit Price ÷ Danish Unit Price).
- **Category Price Gap** = the unweighted mean of the item gaps over Basket Items priced in both countries. Items missing on either side are left out and reported.
- **Regular prices are national:** Willys regular prices are treated as applying at every Willys Store. REMA 1000 regular prices are Danish national prices.

### Reference-data API (part of seam 2)

- **`GET reference data for a Trip Date`** returns:
  - Price Gaps per Destination per Category, with a per-Basket Item breakdown: cheapest product name, Retailer or Store, Unit Price, offer or regular, valid-to
  - Crossing Fee tables, valid for the Trip Date
  - Danish and Swedish petrol prices, and the default electricity price
  - Exchange rate with its date
  - Data freshness: the newest observation date, and a stale flag when it's more than 14 days before today
  - Source attributions
- **`GET distances for a postcode`** returns the one-way distance to each Destination, or "unknown postcode".
- The client fetches reference data once per Trip Date and does all calculation itself, using the shared calculator.

### Importers and the import command

- **One manual command** runs all importers, or a named subset. Each importer is isolated: a failure is reported and the others still run. After each run it prints the match report.
- **Tjek offers:**
  - Sweden: per Store, using each Store's catalog for the week found by dealer id near the Destination's coordinates.
  - Denmark: per Retailer, using catalogs near Copenhagen. Danish Retailers: REMA 1000, Netto, Lidl DK, Føtex, Bilka.
  - Swedish Stores, Hyllie: Willys Emporia, City Gross Hyllie, Lidl Delsjögatan.
  - Swedish Stores, Väla: Willys Väla, Stora Coop Väla, Lidl Drottninghögsvägen.
  - ICA is excluded (ADR 0002).
  - Offer fields used: heading, description, price, quantity (unit, size, pieces), run-from and run-till, dealer.
  - Member-only Offers are detected by Retailer-specific phrases in the description, kept in the seed data ("För dig med WillysPlus", "Medlemspris", "Lidl Plus", "PRIO-medlemmar"). They are stored and flagged, never used.
- **Willys regular prices:** the product search endpoint, queried with each Basket Item's Swedish search words.
- **REMA 1000 regular prices:** the product search endpoint, queried with each Basket Item's Danish search words.
- **ECB exchange rate:** SEK and DKK against EUR, giving SEK→DKK.
- **EU Weekly Oil Bulletin:** petrol (Euro-super 95) with taxes, for Denmark and Sweden.
- Every importer writes raw Price Observations: source, Retailer, Store (Swedish offers only), product text, price, currency, quantity, regular or Offer, member-only flag, valid-from, valid-to, and import time. Nothing is updated in place.

### Database (Drizzle, SQLite)

Tables:

- Retailers
- Stores (with the Destination, the Tjek dealer id, and the Willys store id where relevant)
- Destinations (with the Crossing)
- Categories
- Basket Items (with Category and Match Rules)
- Price Observations
- Exchange rates (date, rate, source)
- Fuel prices (country, date, price, source)
- Crossing Fees (Crossing, ticket kind or Discount Agreement, season or bracket, price, valid-from, source)
- Ferry seasons
- Lost Deposit amounts
- Settings (default electricity price, consumption defaults)
- Postcode distances (postcode, Destination, km)
- Import runs (time, source, outcome)

### Seed data

- Versioned seed files are loaded by one command. They hold:
  - Crossings and Destinations
  - Retailers and Stores with their external ids
  - the four Categories
  - the Sample Basket: the 27 Basket Items agreed in design, with Danish and Swedish search words, pack-size ranges and excluded words
  - member-offer phrases
  - Crossing Fees as researched on 2026-10-08
  - ferry seasons
  - Lost Deposit (2 SEK for cans and small bottles, 3 SEK for large bottles)
  - Vehicle defaults
  - the default electricity price
- **Crossing Fees as of 2026-10-08:**
  - Bridge: 420 kr online ticket per single trip; ØresundGO 182 kr per trip.
  - Ferry: 595 / 620 kr same-day round trip; AutoBizz single 225 / 255 kr; multi-trip card per trip 359 / 249 / 189 / 159 kr for brackets 3–9 / 10–19 / 20–34 / 35+.
  - The ferry's high season is 1 June–31 August.

### Postcode distances

- A one-off script builds the table of road distance from each Danish postcode's centre point to each Destination, via its Crossing, excluding the ferry leg. The output goes in the database.
- Still to decide in its ticket: the source of postcode centre points and the routing service.

### Client

- Mobile-first React UI in Danish.
- All inputs are mirrored into the URL query string, and the last inputs are restored from browser storage when there's no query string.
- It shows the stale-data warning, the exchange rate and date, the "How we calculate" page, and the Lavpris note.

## Testing Decisions

- **What a good test is:** it drives the system through a seam's public interface and asserts on observable results: returned values, API responses, printed reports. It never touches internal functions, table layouts or private helpers. Tests should survive a refactor that keeps behaviour unchanged.
- **Test runner:** Vitest for the shared and server packages. Playwright for the UI smoke test.
- **Seam 1, the shared calculator:** table-driven tests of the calculator function. They cover:
  - bridge vs ferry fees
  - ferry high and low season by Trip Date
  - each Discount Agreement
  - petrol vs electric Driving Cost
  - Fill-up Saving, including that electric Vehicles get none
  - negative Price Gaps
  - Break-even Spend, including "never pays off", fill-up alone covering the trip, and no spend entered
  - which trip is marked cheaper
- **Seam 2, the server end to end:**
  - **Setup:** a test SQLite database loaded from the seed files plus test-specific seeds. Importers run against recorded source responses (fixtures) instead of the network.
  - **Run:** the import command.
  - **Assert on:** the match report output and the reference-data and distances API responses.
  - **Coverage:**
    - Tjek parsing and Unit Price, including multi-buys and multipacks
    - member-only exclusion
    - Match Rules: search words, pack-size range, excluded words, and a rule edit taking effect without re-import
    - Offers valid or expired on the Trip Date
    - cheapest Store per Destination vs the cheapest Danish Retailer
    - Lost Deposit on soft drinks
    - exchange-rate conversion
    - Basket Items missing in one country being left out and reported
    - stale-data flag
    - one importer failing without stopping the others
    - unknown postcode
- **UI smoke test:** one Playwright test against the locally running app with seeded data. It checks that:
  - entering a postcode and Planned Spend shows two Shopping Trip results with one highlighted
  - reloading the shared URL restores the same inputs and result
- **Prior art:** none, because the repo is new. These tests set the pattern.
- **Fixtures:** raw responses captured during design research are in `research-samples/` next to this spec:
  - Tjek Swedish offers for Willys, Lidl, City Gross, Coop and ICA
  - Tjek catalogs and stores near Hyllie and Väla
  - a Willys store campaign response
  - ECB exchange rates
  - the Weekly Oil Bulletin
  - a summary
  Danish Tjek offers, the Willys product search and the REMA 1000 product search still need recording. Trim fixtures to what the tests need.

## Out of Scope

- Deployment and hosting (ADR 0001: local only for now).
- Analytics, cookies, user accounts and saved trips.
- Product-level shopping lists. v1 is spend per Category.
- Alcohol, meat as a Category, snus and tobacco.
- ICA prices and Offers (ADR 0002).
- Member-only prices of any Retailer.
- Long ferry routes (Frederikshavn–Göteborg, Rønne–Ystad) and the closed Grenaa–Halmstad route.
- Vehicles over 6 m or with a trailer.
- Lavpris dynamic ferry fares, beyond a note.
- The value of the shopper's time.
- Scheduled or automatic imports. All imports are manual.
- An admin page. Manual data lives in seed files.
- Customs and import limits guidance, beyond what's needed to exclude alcohol and tobacco.
- English UI.
- Search-engine optimisation. Revisit before going public (ADR 0001).

## Further Notes

- All price and fee figures in this spec were researched on 2026-10-08. Treat them as seed values that will go out of date. Check the bridge's 14 September 2026 price change and the ferry seasons when seeding.
- Every data source is unofficial (ADR 0002). Check each one's terms of use before the site goes public. The Coop endpoint's keys rotate, but Coop prices come through Tjek, so that doesn't matter here.
- Tjek returns only one country's catalogs for a given set of coordinates. Query Swedish Stores with Swedish coordinates and Danish Retailers with Danish coordinates.
- ICA offers on Tjek carry no member-only (Stammis) marker. That is the reason ICA is excluded. Don't add it back through Tjek.
- Swedish food VAT was cut temporarily, from 1 April 2026 to 31 December 2027. The measured Price Gaps will shift when it ends.
- As agreed in design, the implementation coding should be handed to Sonnet 5.5.
