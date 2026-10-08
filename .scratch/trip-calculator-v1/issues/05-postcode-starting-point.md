# 05: Postcode Starting Point

**What to build:** The shopper types a Danish postcode as their Starting Point. The one-way distance to each Destination (via its Crossing, excluding the ferry leg) is filled in automatically. The shopper can still override the kilometres by hand. An unknown postcode gives a clear Danish message.

The distances come from a table generated once by a script and stored in the database. The site calls no routing service at runtime. This ticket decides and records two things: where postcode centre points come from, and which routing service the one-off script uses.

**Blocked by:** 04 (Vehicle and Driving Cost)

**Status:** ready-for-agent

- [x] Decide the source of postcode centre points and the routing service for the script, and note both in this ticket.
- [x] A one-off script produces the postcode → Destination one-way road distance table, and the seed/load step puts it into the database.
- [x] The distances API returns the distance to each Destination for a postcode, or "unknown postcode".
- [x] Entering a postcode fills both distances. Editing a distance afterwards overrides it, and both the postcode and any override are in the shareable URL.
- [x] An unknown postcode shows a Danish error and no misleading result.
- [x] Server tests cover a known postcode, an unknown postcode, and a malformed input.

## Comments

**Implemented.** Full table generated: 1,128 postcodes x 2 Destinations (2,256 rows) in `server/seed/postcode-distances.json`, loaded by `npm run seed` into table `postcode_distances` (migration `0006_harsh_madame_web`).

**Decisions**
- Centre points: GeoNames postal-code dump for Denmark (`download.geonames.org/export/zip/DK.zip`, CC BY 4.0, 1,159 rows). DAWA (`api.dataforsyningen.dk/postnumre`, `dawa.aws.dk`) now answers 410 Gone, so the suggested source is gone. Attribution to GeoNames should appear in "How we calculate" (ticket 13). Note GeoNames has no 1000 (a PO-box code); København K is 1050 etc.
- Routing: public OSRM demo (`router.project-osrm.org`, car profile), sequential requests with a 1.1 s pause, ~45 min for the full run. OSRM cannot exclude ferries, so each route is requested with steps and any route containing a ferry step is rejected. Starts west of the Great Belt that OSRM would send over a ferry are retried via the bridge (none turned out to need it). Ferry Destination = start -> Helsingør terminal + Helsingborg terminal -> Väla (8.6 km, constant); the ferry leg itself is never routed.
- Islands: the 31 postcodes whose only route to Sweden is by ferry are omitted, so the lookup says unknown: Bornholm (37xx), Ærø/Marstal/Birkholm/Strynø/Lyø/Avernakø, Samsø, Læsø, Anholt, Fanø, Fur, Barsø, Endelave, Tunø, Agersø, Omø, Orø, Sejerø, Askø, Fejø, Femø. The Danish error text names Bornholm and says to enter the distance by hand.
- Distances are rounded to 0.1 km. Postcode centre = GeoNames point, so distances are approximate for large postcodes.

**Re-run:** `npm run distances:build -w server` (needs internet; resumable via `data/postcode-routes-cache.json`; delete the cache to refresh routing). Not run by tests or `npm run seed`.

**API:** `GET /api/postcodes/:postcode/distances` -> `{postcode, name, distanceKm: {bridge, ferry}}`; 400 `malformed-postcode` unless exactly four digits; 404 `unknown-postcode`.

**Client:** URL input `postnr`. A looked-up distance only fills a Destination whose `km-bro` / `km-faerge` is empty; typing a distance overrides, clearing it returns to the postcode value. Unknown postcode or failed lookup shows a Danish alert and hides the trip result unless both distances are entered by hand.

**Flag:** the tests assert plausible ranges for 2300 and 8000 rather than exact km, so re-running the script does not break them.
