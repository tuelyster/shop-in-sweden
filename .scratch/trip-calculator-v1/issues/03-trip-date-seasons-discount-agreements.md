# 03: Trip Date, ferry seasons and Discount Agreements

**What to build:** The shopper picks the Trip Date, which defaults to the next Saturday. The ferry's Crossing Fee follows the season that date falls in. The shopper can also say which Discount Agreements they have:

- **ØresundGO** for the bridge
- **AutoBizz** for the ferry
- **a ferry multi-trip card**, choosing its bracket: 3–9, 10–19, 20–34 or 35+ trips

Each Crossing Fee then uses the shopper's own per-trip price. Annual fees are not counted. See the spec's calculator rules and Crossing Fees as of 2026-10-08.

**Blocked by:** 01 (Walking skeleton), 02 (Inputs in a shareable URL)

**Status:** ready-for-agent

- [x] Seed data holds the ferry seasons (high season 1 June–31 August) and all Discount Agreement prices, each with its valid-from date and source:
  - Bridge: ØresundGO 182 kr per trip.
  - Ferry: round trip 595 / 620 kr (low / high season).
  - Ferry: AutoBizz single 225 / 255 kr (low / high season).
  - Ferry: multi-trip card 359 / 249 / 189 / 159 kr per trip, for brackets 3–9 / 10–19 / 20–34 / 35+.
- [x] The Trip Date input defaults to the next Saturday (today, if today is Saturday) and is part of the shareable URL.
- [x] The reference-data API returns the Crossing Fees that apply on a given Trip Date.
- [x] Bridge with ØresundGO: 2 × the ØresundGO per-trip price.
- [x] Ferry with AutoBizz: 2 × the AutoBizz single price for the season.
- [x] Ferry with a multi-trip card: 2 × the bracket's per-trip price.
- [x] Ferry with no Discount Agreement: the round-trip ticket for the season.
- [x] The Discount Agreement inputs are part of the shareable URL.
- [x] Calculator tests cover each Discount Agreement, both seasons, and Trip Dates on the season boundaries (31 May, 1 June, 31 August, 1 September).

## Comments

**Implemented.** Types in `shared/src/types.ts`: `CrossingFeeEntry` now carries `agreement` (none/oresundgo/autobizz/multi-trip), `season` (low/high/null) and `bracket`; `ReferenceData.seasons` holds the high season as data (`server/seed/seasons.json`, new `seasons` table; migration `0001_cuddly_sue_storm`). `TripInputs` = `tripDate`, `oresundGo`, `autoBizz`, `multiTripCard`. The fee rule lives only in the calculator (`crossingFee`): it resolves the season from `reference.seasons`, drops fees not yet valid on the Trip Date, drops Discount Agreement prices the shopper does not hold, and takes the latest valid price per ticket. `GET /api/reference-data?dato=YYYY-MM-DD` (default today, 400 on bad date) only filters by valid-from. Client: URL inputs `oresundgo=0|1`, `autobizz=0|1`, `turkort=3-9|10-19|20-34|35+|ingen`; the page refetches reference data when the Trip Date changes.

**Decisions the spec did not cover:** (1) A held Discount Agreement replaces the default ticket even if dearer (3-9 card in low season: 2 x 359 = 718 > 595); with several held agreements the cheapest wins. (2) Bridge fees are valid from 2026-09-14, so an earlier Trip Date has no bridge fee: the server returns it empty, the calculator throws, and the UI shows "Vi har ingen priser for den valgte dato." (3) Multi-trip card and ØresundGO fees use validFrom 2026-09-14 / 2026-01-01 as placeholders for the researched date. (4) Smoke tests pin `dato` since the default depends on the clock.
