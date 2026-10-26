# OpenCode Go — $10 / Go Plus $40 Subscription Cost Comparison Page

A single self-contained HTML page that answers: **"What can an OpenCode Go ($10/mo) or Go Plus ($40/mo) subscription get you?"**

It lines up every model on both plans against one everyday example (default:
100M total tokens at a 97% prompt-cache hit rate with 0.8% output share) so models with different
monthly allowances can be compared side by side. Token prices are identical on both plans —
only the included monthly allowance differs. A plan radio (Opencode Go default, Opencode Go Plus)
switches the whole table between the two allowances.

Source prices: https://opencode.ai/v2/docs/console/go/ (Go $10/mo plan table).

## Files

- `index.html` — the whole app (markup + CSS + JS, no build step, no dependencies).
  Open it directly in a browser via `file://`, or serve the folder:
  `python3 -m http.server 8000` → `http://localhost:8000/index.html`
- No other files are needed. Prices are embedded in the page (see below).

## How it works

- **Fully client-side.** No server code, no `fetch()`, no network requests except the
  Google Fonts stylesheet (Asap Sharp). All math and rendering happen in the `<script>`.
- **Price data** lives in the `MODELS` array near the top of the script:
  `{ model, input, output, cached, limit, limitPlus, note? }` — prices are $ per 1M tokens,
  `limit` is the Go-plan ($10) monthly allowance, `limitPlus` the Go Plus ($40) allowance
  (`null` = Unlimited/free). `activeLimit(m)` / `activePrice()` select the allowance and plan
  price from the radio (`PREFS.plan`, `"go"` default); all cost-derived columns
  (sub cost, % of cash, subs needed, blocks per sub, % of allowance, max tokens, allowance)
  and the table headers (`#thCash`, `#thSubs`, `#thPer`, `#thLimit`) follow the active plan.
- **"↻ Refresh from source" button** fetches the latest Go **and** Go Plus tables from the docs
  and updates the table in place (successful refreshes are remembered for 1 hour
  under `go-live-v2` as `{ go, plus }`). Flow: try the docs URL directly (usually blocked by the
  browser's cross-site rules), then fall back to the Jina text-proxy mirror
  (`PROXY_URL`), which returns the page as markdown. Parsing:
  `parseSourceMarkdown` collects every pipe-table with Input + Monthly-limit columns
  (Go first, Go Plus second); `parseSourceHtml` prefers the `[slot="go"]` / `[slot="go-plus"]`
  tables and falls back to smallest-total = Go, largest = Go Plus. `mergePlanRows` joins
  them by model name (Go Plus falls back to the built-in `limitPlus` when a row is missing —
  the text-proxy mirror currently renders only the Go tab, so proxy refreshes update Go
  prices and keep the built-in Go Plus allowances;
  legacy `go-live-v1` caches migrate the same way). Per-cell rules: `Free` → 0,
  struck-through discounts (`~~$4.00~~ $2.00`) → last price wins, `Unlimited` limit
  → `null`, tiered names normalized (`"(≤ 256K tokens)"` → `"(≤ 256K)"`), existing
  `note` labels kept by model-name match. On total failure the button reports why
  and keeps current prices — it never leaves the table empty.
- **Cost formula** (output included at the full output rate):
  `cost = freshM × input + cachedM × cached-read + outM × output`,
  where `freshM`/`cachedM`/`outM` come from the total-tokens + hit-rate + output-% controls
  (`outM = totalM × p`, `inM = totalM × (1−p)`, split into fresh/cached by `h`).
  **"Sub cost"** (pro-rata subscription burn) = `cost ÷ allowance × plan price`
  (allowance = active plan's `limit`/`limitPlus`; e.g. $3.73 ÷ $60 × $10 ≈ $0.62 on Go).
- **"Max tokens / sub"** = `allowance ÷ blended $/1M`, with
  `blended = (1−p) × ((1−h) × input + h × cached) + p × output`. Recomputed when the hit rate or output % changes.
  Allowance here is the active plan's (`limit` vs `limitPlus`).
- **Rendering:** `render()` calls `updatePlanHeaders()` first, rebuilds `tbody` cheapest-first from `MODELS`, then
  `applyColVisibility()`, `sortTbody()`, `paintSort()` run in that order.
- **Controls:** plan radio (Opencode Go default, Opencode Go Plus), search, total tokens (in millions), hit-rate %, output % of total,
  "Show free models" checkbox
  (free = `input === 0 && cached === 0`), column chooser (`<details id="colpick">`,
  driven by the `COLUMNS` array; Model column 0 is always shown).
- **Sorting:** click any header. Active column is highlighted with ▲/▼, others show ↕.
  Clicking a new column sorts ascending; clicking it again flips direction.
  The Max-tokens and Sub-cost columns sort by exact value via their `data-val` attribute.
- **Persistence (localStorage):** form state (including plan) + column visibility + sort column/direction
  are saved under `go-prefs-v6` on every change and restored on load
  (`restorePrefs()` runs inside `boot()` before first `render()`; unknown/missing keys fall back to defaults,
  `plan` falls back to `"go"`; older prefs migrate with `cost` forced visible and sort index 1↔2 swapped
  where the Sub-cost/Cost reorder applies (v3 prefs additionally shift `sortCol >= 2` by +1 first).

## Developing the page

- **Update prices:** edit the `MODELS` array in `index.html`, reload. Keep it in
  the same order/shape as the official docs table (tiered rows listed separately,
  e.g. `≤ 256K` / `> 256K`, Peak / Off-Peak).
- **Add a column:** append to `COLUMNS` (`{ key, label }`), add a `<th>`, emit the
  `<td>` in `render()`'s row template (add `data-val` with the raw number if the
  display text is formatted with suffixes like M/B), and bump `colspan` on the
  loading row. Saved prefs automatically default new columns to visible.
- **Change defaults:** edit `defaultPrefs()` (`plan: "go"`, `tokensM: 100, hit: 97, outPct: 0.8, q: "",
  showFree: true`, all columns on, sort = Sub cost ascending).
- **Styling:** plain CSS in `<style>`; font is Rubik via Google Fonts link.
  Layout is full-width, no card wrapper. Active sort header uses `th.sorted`.
- **Formatting helpers:** `money(n)` for $ amounts, `fmtTokens(n)` for M/B token counts.

## Testing changes

1. Syntax check the script:
   `python3 -c "import re;print(re.search(r'<script>(.*)</script>',open('index.html').read(),re.S).group(1))" > /tmp/check.js && node --check /tmp/check.js`
2. Functional check: run the page logic in Node with stubbed `document`/`localStorage`
   (no `fetch` needed), pre-seed `go-prefs-v1`, call the header click handlers, and
   assert on `tbody.innerHTML`, header arrows (`▲/▼/↕`), and stored prefs.
3. Spot-check math (h = 97%, T = 100M total, 0.8% out): GLM-5.3-Flash cost $3.73,
  sub cost ≈ $0.62 on Go ($3.73 ÷ $60 × $10) and ≈ $0.83 on Go Plus ($3.73 ÷ $180 × $40);
   at 0% out it reproduces the old input-only $3.36. Session scale (11.9M total,
   0.99% out): Muse Spark 1.3 ≈ $0.082.
4. Test the source parser: download the proxy markdown
   (`curl -s "https://r.jina.ai/https://opencode.ai/v2/docs/console/go/" -o /tmp/go.md`),
   evaluate the page script in Node with stubbed `document`/`localStorage`, expose
   `parseSourceMarkdown`, and assert all parsed rows match `MODELS` field by field
   (ignoring `note`). Also exercise `refreshFromSource` with stubbed `fetch`
   (direct rejects, proxy resolves) and with all-rejecting `fetch` for the failure path.
