# 03: Trip Date, ferry seasons and Discount Agreements

**What to build:** The shopper picks the Trip Date, which defaults to the next Saturday. The ferry's Crossing Fee follows the season that date falls in. The shopper can also say which Discount Agreements they have:

- **ØresundGO** for the bridge
- **AutoBizz** for the ferry
- **a ferry multi-trip card**, choosing its bracket: 3–9, 10–19, 20–34 or 35+ trips

Each Crossing Fee then uses the shopper's own per-trip price. Annual fees are not counted. See the spec's calculator rules and Crossing Fees as of 2026-10-08.

**Blocked by:** 01 (Walking skeleton), 02 (Inputs in a shareable URL)

**Status:** ready-for-agent

- [ ] Seed data holds the ferry seasons (high season 1 June–31 August) and all Discount Agreement prices, each with its valid-from date and source:
  - Bridge: ØresundGO 182 kr per trip.
  - Ferry: round trip 595 / 620 kr (low / high season).
  - Ferry: AutoBizz single 225 / 255 kr (low / high season).
  - Ferry: multi-trip card 359 / 249 / 189 / 159 kr per trip, for brackets 3–9 / 10–19 / 20–34 / 35+.
- [ ] The Trip Date input defaults to the next Saturday (today, if today is Saturday) and is part of the shareable URL.
- [ ] The reference-data API returns the Crossing Fees that apply on a given Trip Date.
- [ ] Bridge with ØresundGO: 2 × the ØresundGO per-trip price.
- [ ] Ferry with AutoBizz: 2 × the AutoBizz single price for the season.
- [ ] Ferry with a multi-trip card: 2 × the bracket's per-trip price.
- [ ] Ferry with no Discount Agreement: the round-trip ticket for the season.
- [ ] The Discount Agreement inputs are part of the shareable URL.
- [ ] Calculator tests cover each Discount Agreement, both seasons, and Trip Dates on the season boundaries (31 May, 1 June, 31 August, 1 September).
