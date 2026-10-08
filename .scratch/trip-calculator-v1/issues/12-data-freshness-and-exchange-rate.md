# 12: Data freshness and exchange rate on the page

**What to build:** The shopper can always see how current the numbers are:

- when prices were last updated
- a visible Danish warning when the newest price data is more than 14 days old
- the exchange rate used, with its date

**Blocked by:** 07 (Price Gaps and Planned Spend)

**Status:** ready-for-agent

- [ ] The reference-data API returns the newest Price Observation date and a stale flag, which is true when that date is more than 14 days before today.
- [ ] The page shows "prices updated X days ago" and the exchange rate with its date.
- [ ] The page shows a clear warning when the data is stale.
- [ ] Server tests cover fresh and stale data, with a controllable "today".
