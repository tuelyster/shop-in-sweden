# 04: Vehicle and Driving Cost (manual km)

**What to build:** The shopper says whether their Vehicle runs on petrol or electricity and enters the one-way driving distance to each Destination by hand. Each Shopping Trip then shows its Driving Cost and its Trip Cost (Crossing Fee + Driving Cost), and the cheaper trip is decided on Trip Cost.

Consumption and energy price have sensible seeded defaults per energy type. The shopper can edit them under an "Advanced" section. Postcode lookup comes in ticket 05.

**Blocked by:** 01 (Walking skeleton), 02 (Inputs in a shareable URL)

**Status:** ready-for-agent

- [ ] Seed data holds Vehicle defaults:
  - petrol: about 6 L/100 km, with a manually seeded Danish petrol price
  - electric: consumption in kWh/100 km, with the default electricity price
  - each price carries its source and date
  - the default electricity price must be chosen and its source recorded
- [ ] Driving Cost = 2 × one-way distance × consumption ÷ 100 × energy price, calculated separately for each Shopping Trip.
- [ ] Trip Cost = Crossing Fee + Driving Cost. The cheaper trip is decided on Trip Cost.
- [ ] Each trip's breakdown shows its Crossing Fee, Driving Cost and Trip Cost.
- [ ] Energy type, consumption, energy price and the per-Destination distances are part of the shareable URL.
- [ ] Calculator tests cover petrol vs electric, edited consumption and price, and a case where the Driving Cost difference changes which trip is cheaper.
