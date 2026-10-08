# 04: Vehicle and Driving Cost (manual km)

**What to build:** The shopper says whether their Vehicle runs on petrol or electricity and enters the one-way driving distance to each Destination by hand. Each Shopping Trip then shows its Driving Cost and its Trip Cost (Crossing Fee + Driving Cost), and the cheaper trip is decided on Trip Cost.

Consumption and energy price have sensible seeded defaults per energy type. The shopper can edit them under an "Advanced" section. Postcode lookup comes in ticket 05.

**Blocked by:** 01 (Walking skeleton), 02 (Inputs in a shareable URL)

**Status:** ready-for-agent

- [x] Seed data holds Vehicle defaults:
  - petrol: about 6 L/100 km, with a manually seeded Danish petrol price
  - electric: consumption in kWh/100 km, with the default electricity price
  - each price carries its source and date
  - the default electricity price must be chosen and its source recorded
- [x] Driving Cost = 2 × one-way distance × consumption ÷ 100 × energy price, calculated separately for each Shopping Trip.
- [x] Trip Cost = Crossing Fee + Driving Cost. The cheaper trip is decided on Trip Cost.
- [x] Each trip's breakdown shows its Crossing Fee, Driving Cost and Trip Cost.
- [x] Energy type, consumption, energy price and the per-Destination distances are part of the shareable URL.
- [x] Calculator tests cover petrol vs electric, edited consumption and price, and a case where the Driving Cost difference changes which trip is cheaper.

## Comments

**Implemented.** Reference data now carries `vehicleDefaults` (table `vehicle_defaults`, seed `server/seed/vehicle-defaults.json`, migration `0002_flat_sersi`): petrol 6 L/100 km at 19.5 DKK/L (EU Weekly Oil Bulletin, Euro-super 95 Denmark 2.605 EUR/L, 2026-10-05); electric 18 kWh/100 km at 2.50 DKK/kWh. `TripInputs` gains `energyType`, `consumptionPer100Km` / `energyPriceDkk` (null = the energy type's default, so unedited fields follow the type) and `distanceKm: Record<CrossingId, number | null>` (null = not entered, Driving Cost 0). `ShoppingTripResult` gains `drivingCostDkk` and `tripCostDkk`; the cheaper trip is decided on Trip Cost. URL inputs: `energi=benzin|el`, `forbrug`, `energipris`, `km-bro`, `km-faerge` (empty = not entered). UI: a "Bil" fieldset with energy type and distances, consumption/price under "Avanceret", a gentle prompt when a distance is missing, and each trip shows Overfart, Kørsel and Turens pris.

**Electricity default (flag):** I found no current official figure for Danish household electricity incl. taxes. The seeded 2.50 DKK/kWh is an estimate inside the typical 2026 range of 1.50-3.00 kr/kWh, anchored on Forsyningstilsynet's elprisstatistik (2.92 kr/kWh in Q1 2024, before the 2026 electricity-tax cut). The seed's source text says so. Replace it with a published figure when one is found. 18 kWh/100 km is an assumed typical electric car.

**Decisions:** (1) Overrides are nullable, so only edited values are in the URL; the client does not hard-code any price. (2) Ticket 05 should fill a distance only where `km-bro` / `km-faerge` is null, so a manual entry wins (the manual inputs are the override layer). (3) Distance prompt shows when either distance is empty; a missing distance counts as 0 km, which flatters that trip until it is entered.
