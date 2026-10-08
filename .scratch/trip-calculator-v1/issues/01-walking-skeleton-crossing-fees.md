# 01: Walking skeleton: compare the two Crossings' fees

**What to build:** A shopper opens the Danish web page and sees the two Shopping Trips side by side, the Øresund Bridge to Hyllie and the Helsingør–Helsingborg ferry to Väla Centrum, each with its round-trip Crossing Fee. The cheaper trip is highlighted.

This is the thinnest end-to-end path, and it sets up everything later tickets build on:

- the client, server and shared workspace packages
- SQLite through Drizzle, with a seed command
- the shared calculator's public function
- the reference-data API
- the test harnesses: Vitest and Playwright

Default fees only: no Discount Agreements, no Trip Date or season yet (use the low-season ferry price). See the spec's "Shape", "Shared calculator module", "Seed data" and "Testing Decisions" sections, and ADR 0001.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Running one command starts the client and server locally. A separate command loads the seed files into a fresh SQLite database.
- [ ] Seed files hold the two Crossings, their Destinations, and the default Crossing Fees: the bridge online ticket at 420 kr per single trip, and the ferry same-day round trip at 595 kr (low season). Each fee carries the date it applies from and its source.
- [ ] The shared calculator's public function takes trip inputs and reference data. It returns one result per Shopping Trip with its Crossing Fee (bridge 2 × single; ferry round-trip ticket) and marks the cheaper trip.
- [ ] The reference-data API returns the Crossing Fee tables from the database.
- [ ] The client fetches reference data, runs the calculator in the browser, and shows both trips in Danish with amounts in DKK, the cheaper one highlighted. The layout is mobile-first.
- [ ] A Vitest test of the calculator through its public function covers the bridge and ferry fees and which trip is cheaper.
- [ ] A Vitest server test seeds a test database and checks the reference-data API response.
- [ ] A Playwright smoke test against the running app checks that the page shows two Shopping Trips with exactly one highlighted.
