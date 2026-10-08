# 08: Break-even Spend

**What to build:** Each Shopping Trip shows its **Break-even Spend**: the total Planned Spend at which Net Saving is zero for the shopper's mix of Categories. Edge cases are shown plainly:

- **no spend entered:** use equally weighted Categories
- **Fill-up Saving alone covers the Trip Cost:** the break-even is 0
- **the weighted Price Gap is zero or negative:** show "never pays off" instead of a number

Fill-up Saving is zero until ticket 11, but the formula must already include it.

**Blocked by:** 07 (Price Gaps and Planned Spend)

**Status:** ready-for-agent

- [ ] Break-even Spend = (Trip Cost − Fill-up Saving) ÷ the spend-weighted average Price Gap.
- [ ] With no Planned Spend entered, Categories are weighted equally.
- [ ] Fill-up Saving ≥ Trip Cost gives a break-even of 0.
- [ ] A weighted gap ≤ 0 gives "never pays off" in Danish, not a number.
- [ ] Amounts are rounded only for display.
- [ ] Calculator tests cover the normal case and each edge case above.
