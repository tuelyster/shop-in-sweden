# 10: Lost Deposit on soft drinks

**What to build:** Swedish deposit can't be reclaimed in Denmark, so the **Lost Deposit** is added to Swedish soft-drink prices before their Unit Price is computed. That's 2 SEK per can or small bottle, and 3 SEK per large bottle. Danish soft-drink prices exclude deposit. The soft-drinks Price Gap then reflects what a Danish shopper really pays.

**Blocked by:** 07 (Price Gaps and Planned Spend)

**Status:** ready-for-agent

- [ ] Seed data holds the Lost Deposit amounts per container type, with source and date.
- [ ] Swedish soft-drink prices get deposit × number of containers added before the Unit Price is computed, for both regular prices and Offers once ticket 09 lands.
- [ ] Danish prices are compared without deposit.
- [ ] The Basket Item breakdown makes it visible that the Swedish price includes Lost Deposit.
- [ ] Server end-to-end tests cover a multipack of cans and a large bottle.
