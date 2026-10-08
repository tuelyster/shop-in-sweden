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

**Status:** ready-for-agent

- [ ] A "How we calculate" page in Danish, reachable from the calculator, covering the points above in the language of `CONTEXT.md`.
- [ ] The alcohol-and-meat note and the Lavpris note appear on the calculator page.
- [ ] Source attributions match the sources the reference-data API reports.
- [ ] The Playwright smoke test checks that the page is reachable.
