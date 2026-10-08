# Prices from unofficial retailer and Tjek endpoints

We measure Price Gaps on our own Sample Basket rather than using official statistics. Eurostat's price-level indices were the easy option, but they're a year old and miss weekly offers, which are what decides whether this Saturday's trip is worth it.

No supermarket chain in either country publishes an official price API, so prices come from undocumented endpoints:

- **Regular prices:** the Willys (Sweden) and REMA 1000 (Denmark) product searches.
- **Offers in both countries:** Tjek's leaflet API (the service behind eTilbudsavis and eReklamblad). It covers almost every chain in one data format.

Imports are run by hand at low volume. Check each source's terms of use before the site goes public.

## Considered Options

- **Eurostat price indices plus manual adjustments:** rejected as too stale (see above).
- **Each Swedish chain's own offer endpoints (Willys, Coop, ICA):** these mark member-only prices properly, but would mean four fragile importers instead of one.

## Consequences

- ICA is excluded. Its member-only (Stammis) offers aren't marked on Tjek, and member prices must not count. Leaving it out can only understate what Sweden saves, never overstate it.
- Member-only offers from other chains are recognised from phrases in the offer text ("Medlemspris", "WillysPlus", "Lidl Plus", "PRIO"). Use the import's match report to catch any that slip through.
- Any of these endpoints can change or disappear without notice.
