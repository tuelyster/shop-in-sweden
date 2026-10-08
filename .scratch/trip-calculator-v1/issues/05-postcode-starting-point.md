# 05: Postcode Starting Point

**What to build:** The shopper types a Danish postcode as their Starting Point. The one-way distance to each Destination (via its Crossing, excluding the ferry leg) is filled in automatically. The shopper can still override the kilometres by hand. An unknown postcode gives a clear Danish message.

The distances come from a table generated once by a script and stored in the database. The site calls no routing service at runtime. This ticket decides and records two things: where postcode centre points come from, and which routing service the one-off script uses.

**Blocked by:** 04 (Vehicle and Driving Cost)

**Status:** ready-for-agent

- [ ] Decide the source of postcode centre points and the routing service for the script, and note both in this ticket.
- [ ] A one-off script produces the postcode → Destination one-way road distance table, and the seed/load step puts it into the database.
- [ ] The distances API returns the distance to each Destination for a postcode, or "unknown postcode".
- [ ] Entering a postcode fills both distances. Editing a distance afterwards overrides it, and both the postcode and any override are in the shareable URL.
- [ ] An unknown postcode shows a Danish error and no misleading result.
- [ ] Server tests cover a known postcode, an unknown postcode, and a malformed input.
