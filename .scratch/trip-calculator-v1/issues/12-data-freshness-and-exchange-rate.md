# 12: Data freshness and exchange rate on the page

**What to build:** The shopper can always see how current the numbers are:

- when prices were last updated
- a visible Danish warning when the newest price data is more than 14 days old
- the exchange rate used, with its date

**Blocked by:** 07 (Price Gaps and Planned Spend)

**Status:** ready-for-agent

- [x] The reference-data API returns the newest Price Observation date and a stale flag, which is true when that date is more than 14 days before today.
- [x] The page shows "prices updated X days ago" and the exchange rate with its date.
- [x] The page shows a clear warning when the data is stale.
- [x] Server tests cover fresh and stale data, with a controllable "today".

## Comments

Implemented. Decisions:

- "Newest Price Observation date" is the date part (UTC) of the newest `imported_at`, i.e. when prices were last fetched, not `valid_from` (Offers can be valid in the future). Documented in `measureFreshness` in `server/src/app.ts`.
- Reference data gains `freshness: { newestObservationDate, daysOld, stale }`. `stale` is `daysOld > 14` (exactly 14 is fresh). With no observations all are null/false: the UI says "Priserne er ikke hentet endnu." and shows no warning.
- "Today" comes from `createApp(db, { now })` (defaults to the real clock); the same clock supplies the default Trip Date.
- UI: "Priser opdateret i dag / i går / for X dage siden" plus the reworked exchange-rate line "Kurs: 1 SEK = 0,6659 DKK (ECB, 7. okt. 2026)" (4 decimals, as in ticket 07) and a red alert block when stale. Text helpers are in `client/src/freshness.ts` with unit tests.
- E2E covers only the no-data case (the e2e database is seeded, not imported); fresh/stale/14-day/none are covered by server tests.
