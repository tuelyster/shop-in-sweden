# 02: Inputs in a shareable URL

**What to build:** Every input the shopper sets is mirrored into the page URL. Opening that URL elsewhere shows the same inputs and result. With no inputs in the URL, the shopper's last inputs are restored from browser storage. The mechanism must let later tickets add an input simply by registering it, so each new field is shareable automatically.

**Blocked by:** 01 (Walking skeleton)

**Status:** ready-for-agent

- [ ] Changing any registered input updates the URL query string without a page reload.
- [ ] Opening a URL with inputs restores exactly those inputs and the same result.
- [ ] Opening the page with no query string restores the last inputs from browser storage. Without stored inputs it falls back to defaults, and it keeps working when storage is unavailable or throws.
- [ ] Invalid or unknown query values fall back to defaults instead of breaking the page.
- [ ] The Playwright smoke test is extended: set inputs, reload the shared URL in a fresh browser context, and see the same inputs and result.
