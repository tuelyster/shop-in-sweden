# 02: Inputs in a shareable URL

**What to build:** Every input the shopper sets is mirrored into the page URL. Opening that URL elsewhere shows the same inputs and result. With no inputs in the URL, the shopper's last inputs are restored from browser storage. The mechanism must let later tickets add an input simply by registering it, so each new field is shareable automatically.

**Blocked by:** 01 (Walking skeleton)

**Status:** ready-for-agent

- [x] Changing any registered input updates the URL query string without a page reload.
- [x] Opening a URL with inputs restores exactly those inputs and the same result.
- [x] Opening the page with no query string restores the last inputs from browser storage. Without stored inputs it falls back to defaults, and it keeps working when storage is unavailable or throws.
- [x] Invalid or unknown query values fall back to defaults instead of breaking the page.
- [x] The Playwright smoke test is extended: set inputs, reload the shared URL in a fresh browser context, and see the same inputs and result.

## Comments

**Implemented (client only).** `client/src/url-state.ts` is the pure mechanism (`defineInput`, `readValues`, `writeSearch`, `resolveInitialValues`, try/catch-wrapped storage helpers); `client/src/useUrlInputs.ts` is the React hook that mirrors state to the query string via `history.replaceState` and to `localStorage`. Unit tests in `client/src/url-state.test.ts` (vitest config now also includes `client/**/*.test.ts`); Playwright smoke test extended (shared URL in a fresh context, storage restore, invalid values, throwing storage).

**Registering a new input (tickets 03, 04, 07...):** in `client/src/inputs.ts` call `defineInput({ name, defaultValue, parse, serialise })` (`parse` returns `undefined` when invalid -> default) and add it to the exported `inputs` object. `useUrlInputs(inputs)` in `App.tsx` then returns `values.<key>` and `setInput('<key>', v)`; URL/storage sync is automatic.

**Decisions:** Trip Date registered as `?dato=YYYY-MM-DD`, default next Saturday (or today), no calculation effect yet. All registered inputs are always written to the URL, defaults included (so a default that depends on today stays stable when shared). URL beats storage if it contains any registered key. Updates use replaceState (no history entries). Param names are Danish short names; later tickets choose their own.
