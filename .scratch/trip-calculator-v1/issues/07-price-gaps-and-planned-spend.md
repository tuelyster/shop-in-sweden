# 07: Price Gaps and Planned Spend: Gross and Net Saving

**What to build:** The shopper enters Planned Spend in DKK, valued at Danish prices, for each of the four Categories. Each Shopping Trip then shows its **Gross Saving** and **Net Saving**. The cheaper trip is decided on Net Saving, and a negative Net Saving is shown honestly as a loss.

The page also shows the **Price Gap** per Category at each Destination. A Category can be expanded to show each Basket Item's cheapest Swedish and Danish Unit Price, and where it came from.

The server measures Price Gaps for a Trip Date in the reference-data API, using regular prices only. Offers come in ticket 09. See the spec's "Price Gap measurement" and calculator rules.

**Blocked by:** 02 (Inputs in a shareable URL), 06 (Sample Basket and the regular-price import)

**Status:** ready-for-agent

- [x] Per Basket Item at a Destination: compare the cheapest Swedish Unit Price at that Destination's Stores (converted at the latest exchange rate) with the cheapest Danish Unit Price across all Danish Retailers. Willys regular prices count at every Willys Store.
- [x] item gap = 1 − (Swedish DKK Unit Price ÷ Danish Unit Price). The Category Price Gap is the unweighted mean over Basket Items priced in both countries. Gaps can be negative.
- [x] The reference-data API returns Price Gaps per Destination per Category, with a per-Basket Item breakdown: product name, Retailer or Store, Unit Price, regular or Offer. It also returns the exchange rate used.
- [x] The calculator computes Gross Saving = Σ Planned Spend × Price Gap at that Destination, and Net Saving = Gross Saving − Trip Cost.
- [x] Planned Spend inputs for the four Categories are part of the shareable URL.
- [x] The UI shows Gross and Net Saving per trip, a loss when negative, the Price Gap per Category, and the expandable Basket Item breakdown.
- [x] Server end-to-end tests, using fixtures: cheapest Store per Destination vs the cheapest Danish Retailer; exchange-rate conversion; Basket Items missing in one country left out and reported.
- [x] Calculator tests: Gross and Net Saving, negative Price Gaps, and Net Saving deciding the cheaper trip.

## Comments

Built (all acceptance criteria met):

- **Price Gap evaluation** is `server/src/match/price-gaps.ts` (`measurePriceGaps`). It reuses the match report's Match Rule evaluation: `matchItem` and `candidateObservations` were extracted from `buildMatchReport` in `match-report.ts`. `candidateObservations` is the one place where ticket 09 adds the Offers valid on the Trip Date. A national Swedish regular price counts at every Store of its Retailer at the Destination; a Retailer without a Store there does not count. Offers tied to a Store (ticket 09) count only at that Store.
- **API:** `GET /api/reference-data?dato=` now also returns `categories`, `priceGaps` (per Destination id, per Category: `priceGap`, `items` with Danish/Swedish `PricePick` incl. seller, Unit Price in own currency and DKK, regular|offer, validTo; `missingItems`) and `exchangeRate` (rate, date, source). `priceGap: null` means unknown (nothing priced in both countries), never 0.
- **Calculator:** `grossSavingDkk`, `netSavingDkk`, `unknownGapCategoryIds` per trip. The cheaper trip is the one with the highest Net Saving (tie: first Crossing). A Category with Planned Spend but unknown gap adds nothing and is listed. Fill-up Saving (ticket 11) joins the Gross Saving at the marked line in `calculator.ts`.
- **Planned Spend** URL inputs: `kr-dagligvarer`, `kr-slik`, `kr-sodavand`, `kr-pleje` (DKK, default 0).
- **UI:** per trip Gross Saving, Net Saving ("Du sparer/taber N kr."), Price Gap per Category with an expandable Basket Item breakdown, "ingen prisdata endnu" while unknown, exchange rate line.
- **Tests:** calculator tests; `server/test/price-gaps.test.ts` imports the recorded fixtures and asserts through the API (plus extra observations to test Store-vs-Retailer cases); `e2e/planned-spend.spec.ts`. The e2e database is seeded only (no import), so e2e shows "ingen prisdata endnu"; numbers are covered by the server tests.
- **Not yet:** Lost Deposit (ticket 10) is not added to Swedish soft drink prices, so the soft drink gap is too favourable to Sweden. A Swedish price with no exchange rate imported is treated as missing.
- `playwright.config.ts` ports and DB path are overridable via `E2E_CLIENT_PORT`, `E2E_API_PORT`, `E2E_DATABASE_PATH`.
