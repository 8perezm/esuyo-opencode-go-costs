# Testing

Requires Node 18+. Run the suite:

```sh
npm test          # or: node --test test/
```

No dependencies, no build step. The tests load the real inline `<script>` from
`index.html` into a VM with stubbed `document`/`localStorage`/`fetch`
(`test/harness.js`), so there is one source of truth and the tests cannot drift
from the page.

- `test/prefs.test.js` — fresh defaults, v10 → v11 migration, legacy sort-index
  shifts, column visibility, hidden-sort fallback.
- `test/logic.test.js` — formatting helpers, workload math, plan limits.
- `test/parsers.test.js` — the three source parsers and `mergePlanRows` against
  the fixtures in `test/fixtures/`, plus `refreshFromSource` success/fallback/
  failure paths with stubbed `fetch`.
- `test/smoke-source.test.js` — skipped by default; opt in with
  `RUN_LIVE=1 npm test` (macOS/Linux) or `$env:RUN_LIVE="1"; npm test`
  (PowerShell) to also check the live models endpoint.

## Needs a real browser

Node cannot honestly verify rendering, so spot-check these manually:

- Columns ▾ lists "Plus vs Go" and "Teams vs Go" unchecked; ticking reveals
  them, unticking hides them again.
- Sort arrows (▲/▼/↕) respond to header clicks.
- Plan radios update the allowance-derived headers.
- State (plan, search, tokens, hit rate, output %, columns, sort) survives a
  reload.
- Feed badge and the live fetch / CORS against opencode.ai.
