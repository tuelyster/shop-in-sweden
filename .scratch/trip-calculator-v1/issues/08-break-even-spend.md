# 08: Break-even Spend

**What to build:** Each Shopping Trip shows its **Break-even Spend**: the total Planned Spend at which Net Saving is zero for the shopper's mix of Categories. Edge cases are shown plainly:

- **no spend entered:** use equally weighted Categories
- **Fill-up Saving alone covers the Trip Cost:** the break-even is 0
- **the weighted Price Gap is zero or negative:** show "never pays off" instead of a number

Fill-up Saving is zero until ticket 11, but the formula must already include it.

**Blocked by:** 07 (Price Gaps and Planned Spend)

**Status:** done

- [x] Break-even Spend = (Trip Cost − Fill-up Saving) ÷ the spend-weighted average Price Gap.
- [x] With no Planned Spend entered, Categories are weighted equally.
- [x] Fill-up Saving ≥ Trip Cost gives a break-even of 0.
- [x] A weighted gap ≤ 0 gives "never pays off" in Danish, not a number.
- [x] Amounts are rounded only for display.
- [x] Calculator tests cover the normal case and each edge case above.

## Comments

- **Calculator:** each trip now has `breakEvenSpend: BreakEvenSpend` (`{kind:'amount', dkk}` | `{kind:'never'}` | `{kind:'unknown'}`, in `shared/src/types.ts`) and `breakEvenExcludedCategoryIds`. Implemented in `shared/src/calculator.ts` (`breakEven`). Unrounded; the UI rounds.
- **Weights:** a Category's Planned Spend; when no Planned Spend is entered, all Categories weigh 1. Once any spend is entered, Categories with zero spend carry no weight.
- **Unknown gaps (decision):** Categories with a null Price Gap are excluded from the weighting (remaining weights renormalised) and listed in `breakEvenExcludedCategoryIds`; the UI says "Break-even er beregnet uden: ...". If every weighted Category is unknown the result is `unknown` (UI: "Kan ikke beregnes endnu (mangler prisdata)"), distinct from `never`.
- **Order of rules (decision):** Trip Cost - Fill-up Saving <= 0 gives 0 first, even if gaps are unknown or non-positive (nothing left to earn back); then no usable weight gives `unknown`; then weighted gap <= 0 gives `never`; else the division.
- **Fill-up Saving:** `const fillUpSavingDkk = 0` in `calculateTrips` feeds `breakEven`; ticket 11 replaces it (and adds it to Gross Saving at the same spot). The "covers the Trip Cost" test uses a free crossing until then.
- **UI:** "Break-even indkøb" line per trip (`data-testid="break-even"`), "Turen kan ikke betale sig med dette indkøb" for never. E2E (seeded DB, no gaps) asserts the unknown text only; numbers are covered by calculator tests.
