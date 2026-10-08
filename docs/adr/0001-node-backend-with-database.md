# Node backend with a database, not a static site

The calculator itself needs no server: its reference data is small and the arithmetic runs in the browser, so a static site with JSON data files would have worked. We chose a React + TypeScript + Vite frontend with a Node.js backend and a simple database instead, storing all collected prices and reference data in the database. Two reasons: features are planned that will need a server (beyond today's calculator), and building the full stack is an explicit learning goal of the project.

## Consequences

- Hosting must run a server and a database, so the free static-host option is gone. For now the app only runs locally.
- A client-rendered single-page app is weaker for search engines than server-rendered HTML. Revisit this before launching the site publicly.
