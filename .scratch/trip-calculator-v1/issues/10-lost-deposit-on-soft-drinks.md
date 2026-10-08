# 10: Lost Deposit on soft drinks

**What to build:** Swedish deposit can't be reclaimed in Denmark, so the **Lost Deposit** is added to Swedish soft-drink prices before their Unit Price is computed. That's 2 SEK per can or small bottle, and 3 SEK per large bottle. Danish soft-drink prices exclude deposit. The soft-drinks Price Gap then reflects what a Danish shopper really pays.

**Blocked by:** 07 (Price Gaps and Planned Spend)

**Status:** ready-for-agent

- [x] Seed data holds the Lost Deposit amounts per container type, with source and date.
- [x] Swedish soft-drink prices get deposit × number of containers added before the Unit Price is computed, for both regular prices and Offers once ticket 09 lands.
- [x] Danish prices are compared without deposit.
- [x] The Basket Item breakdown makes it visible that the Swedish price includes Lost Deposit.
- [x] Server end-to-end tests cover a multipack of cans and a large bottle.

## Comments

- **Seed:** `server/seed/lost-deposits.json` (table `lost_deposits`, migration `0007_smart_grandmaster`): `small` = 2 SEK per container up to 1 L, `large` = 3 SEK above 1 L; source Pantamera panthojning 2025 (https://pantamera.nu/om-oss/panthojning-2025), valid from 2025-01-01 (researched 2026-10-08).
- **Glass:** not told apart. Glass cannot be recognised reliably from product text, so it follows the size rule (<= 1 L: 2 SEK). A deposit the source reports (Willys) always wins.
- **Rule:** `server/src/match/lost-deposit.ts`, applied in `matchItem` to Swedish observations of the `soft-drinks` Category: Lost Deposit for the whole pack is added to the price before the Unit Price. Stored Willys `deposit` (>0) wins; otherwise rate (by size of one container) x pieces. Danish prices never get it.
- **Cartons:** Orange juice has `noDerivedDeposit: true` in its Match Rule (cartons carry no pant); a stored deposit would still count.
- **Display:** `PricePick.lostDeposit` (SEK for the pack, 0 if none); the breakdown says "inkl. 30 SEK pant"; the match report says "99.90 SEK + 30.00 SEK Lost Deposit = 129.90 SEK for 15 x 33 cl = 26.24 SEK/l".
- **Tests:** `server/test/lost-deposit.test.ts` (Willys 15-pack of cans, large bottle derived, stored beats derived, small bottles, juice, Danish side, Tjek Offers for cans and a large bottle, match report); `import.test.ts` expectation updated.
- **Live (data 2026-10-08, Trip Date 2026-10-10):** soft-drinks Price Gap -27.7 % before, -55.9 % after Lost Deposit, identical at Hyllie and Vala. Willys stores 1 kr deposit for one Energy drink hit.
