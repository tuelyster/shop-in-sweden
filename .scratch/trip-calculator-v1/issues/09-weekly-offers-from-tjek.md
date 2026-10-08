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

- [ ] The Tjek importer queries Swedish Stores with Swedish coordinates and Danish Retailers with Danish coordinates, because Tjek returns one country per query. It pages through results (limit 100).
- [ ] Each Offer is stored as a Price Observation with heading, description, price, currency, quantity (unit, size, pieces), valid-from and valid-to, Retailer, and Store for Swedish Offers.
- [ ] Unit Price uses pieces × size × unit factor, so "2 för 40" and multipacks compare correctly.
- [ ] Member-only Offers are recognised from Retailer-specific phrases held in seed data ("För dig med WillysPlus", "Medlemspris", "Lidl Plus", "PRIO-medlemmar"), flagged, and excluded from Price Gaps.
- [ ] An Offer counts only when valid-from ≤ Trip Date ≤ valid-to.
- [ ] The match report shows Offers picked and rejected, including member-only rejections.
- [ ] Fixtures: use the Swedish Tjek samples in `research-samples/`, and record a Danish Tjek offers response.
- [ ] Server end-to-end tests cover: an Offer beating the regular price; an expired Offer ignored; a member-only Offer excluded; multi-buy Unit Price; an Offer at a Store outside the Destination not counting.
