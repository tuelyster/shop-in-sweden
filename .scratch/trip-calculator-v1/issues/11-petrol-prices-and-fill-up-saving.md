# 11: Petrol prices and Fill-up Saving

**What to build:**

- The import command gains an **EU Weekly Oil Bulletin** importer. It fetches Danish and Swedish petrol prices (Euro-super 95, with taxes), which become the default Danish petrol price for Driving Cost.
- Shoppers with a petrol Vehicle can enter how many litres they'd fill up in Sweden. The **Fill-up Saving** counts towards Gross Saving and the Break-even Spend.
- Electric Vehicles don't see the fill-up input.

**Blocked by:** 04 (Vehicle and Driving Cost), 07 (Price Gaps and Planned Spend)

**Status:** ready-for-agent

- [ ] The Oil Bulletin importer stores petrol prices per country with date and source.
- [ ] The reference-data API returns the latest Danish and Swedish petrol prices. The Danish one replaces the manually seeded default petrol price.
- [ ] Fill-up Saving = litres × (Danish petrol price − Swedish petrol price converted to DKK), for petrol Vehicles only.
- [ ] Fill-up Saving is included in Gross Saving and in the Break-even Spend.
- [ ] The litres input is shown only for petrol Vehicles and is part of the shareable URL.
- [ ] Fixture: the Oil Bulletin sample in `research-samples/`. The Swedish petrol figure looked suspicious during research, so check it when parsing.
- [ ] A server end-to-end test covers the importer and the API output. Calculator tests cover Fill-up Saving for petrol, none for electric, and its effect on break-even.
