# 07: Price Gaps and Planned Spend: Gross and Net Saving

**What to build:** The shopper enters Planned Spend in DKK, valued at Danish prices, for each of the four Categories. Each Shopping Trip then shows its **Gross Saving** and **Net Saving**. The cheaper trip is decided on Net Saving, and a negative Net Saving is shown honestly as a loss.

The page also shows the **Price Gap** per Category at each Destination. A Category can be expanded to show each Basket Item's cheapest Swedish and Danish Unit Price, and where it came from.

The server measures Price Gaps for a Trip Date in the reference-data API, using regular prices only. Offers come in ticket 09. See the spec's "Price Gap measurement" and calculator rules.

**Blocked by:** 02 (Inputs in a shareable URL), 06 (Sample Basket and the regular-price import)

**Status:** ready-for-agent

- [ ] Per Basket Item at a Destination: compare the cheapest Swedish Unit Price at that Destination's Stores (converted at the latest exchange rate) with the cheapest Danish Unit Price across all Danish Retailers. Willys regular prices count at every Willys Store.
- [ ] item gap = 1 − (Swedish DKK Unit Price ÷ Danish Unit Price). The Category Price Gap is the unweighted mean over Basket Items priced in both countries. Gaps can be negative.
- [ ] The reference-data API returns Price Gaps per Destination per Category, with a per-Basket Item breakdown: product name, Retailer or Store, Unit Price, regular or Offer. It also returns the exchange rate used.
- [ ] The calculator computes Gross Saving = Σ Planned Spend × Price Gap at that Destination, and Net Saving = Gross Saving − Trip Cost.
- [ ] Planned Spend inputs for the four Categories are part of the shareable URL.
- [ ] The UI shows Gross and Net Saving per trip, a loss when negative, the Price Gap per Category, and the expandable Basket Item breakdown.
- [ ] Server end-to-end tests, using fixtures: cheapest Store per Destination vs the cheapest Danish Retailer; exchange-rate conversion; Basket Items missing in one country left out and reported.
- [ ] Calculator tests: Gross and Net Saving, negative Price Gaps, and Net Saving deciding the cheaper trip.
