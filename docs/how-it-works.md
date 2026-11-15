# How it works

Single self-contained page (`index.html`, no build step). All math and rendering
happen in the inline `<script>`; the only network requests are Google Fonts
plus the live price fetch.

## Live prices (never stored)

`MODELS` starts empty and is filled on every load by `refreshFromSource()`:

- Tries in order: official Markdown (`go.md`, all three plan tables) →
  docs HTML → Jina text-proxy mirror of the Markdown → legacy HTML mirror
  (Go tab only).
- Markdown parsing (`parseSourceMarkdown`): every pipe-table with
  Input + Monthly-limit columns. Order is Go, Go Plus, Go Teams.
- HTML parsing (`parseSourceHtml`): prefers
  `[data-plan-panel="go|go-plus|go-teams"]` panels (legacy `[slot]` supported);
  falls back to smallest-total = Go, middle = Teams, largest = Go Plus.
- `mergePlanRows()` joins plans by model name. Prices are identical across
  plans — only `limit` (Go $10), `limitPlus` (Go Plus $40), `limitTeams`
  (Go Teams $20/member) differ. A missing plan row falls back to the Go limit.
- Cell rules: `Free` → 0, `~~old~~ new` → last price wins,
  `Unlimited` limit → `null`, `limited time` tag derived from the limit cell.
- Successful fetches cache `{ go, plus, teams }` for 1 hour (`go-live-v3`);
  next load paints from cache, then revalidates. New docs rows appear
  automatically. Total failure keeps cached prices (with reason) or shows an
  error row with Retry.

## Cost model

Inputs: total project tokens `T` (millions), hit rate `h`, output share `p`.

- `outM = totalM × p`, `inM = totalM × (1−p)`,
  `freshM = inM × (1−h)`, `cachedM = inM × h`
- `cost = freshM × input + cachedM × cached-read + outM × output`
  (output always at full rate, no cache discount)
- `sub cost = cost ÷ allowance × plan price`
  (e.g. $3.73 ÷ $60 × $10 ≈ $0.62 on Go)
- `blended = (1−p) × ((1−h) × input + h × cached) + p × output`
- `max tokens / sub = allowance ÷ blended × 1M`
- `plus vs Go = limitPlus ÷ limit`, `teams vs Go = limitTeams ÷ limit`
  (prices cancel out; free rows show `—`)
- `% of cash = cost ÷ plan price`,
  `% of allowance = cost ÷ allowance`

`activeLimit(m)` / `activePrice()` follow the plan radio (`go` default).

## Table

- `render()` → `updatePlanHeaders()` → rebuild `tbody` → `applyColVisibility()` →
  `ensureVisibleSort()` → `sortTbody()` → `paintSort()`.
- Plan radio switches all allowance-derived columns and headers
  (`#thCash`, `#thSubs`, `#thPer`, `#thLimit`).
- `Project tokens` checkbox (off by default) reveals the Total project tokens
  field and the workload columns (`TOKEN_COLS`: Sub cost, Cost, % of cash,
  Subs needed, Blocks per sub, % of allowance). Those 6 columns carry a light
  blue tint (`td.proj` / `th.proj`); reference price columns use grey (`ref`).
- Search filters by model name; `Show free models` hides
  `input === 0 && cached === 0` rows; column chooser (`#colpick`, driven by
  `COLUMNS`) toggles columns, Model always shown.
- Sorting: click any header (▲/▼, others ↕). New column sorts ascending,
  repeat click flips. Max-tokens / Sub-cost / Plus-vs-Go / Teams-vs-Go sort by
  exact `data-val`. Default is **Max tokens / sub descending** (largest first
  = cheapest first). If the stored sort targets a hidden Project column,
  `ensureVisibleSort()` falls back to Max tokens / sub so the indicator stays
  visible.
- Feed badge (`#feedBadge`, `setFeed()`): green `live · all plans`, amber
  `live · partial` / `cached — checking…` / `stale — refresh failed`, blue
  pulsing `checking…`, red `source parse failed`. Hover for details.
- Persistence (`go-prefs-v10` in localStorage): plan, search, tokens, hit rate,
  output %, free-models toggle, column visibility, sort column/direction.
  Restored in `boot()` via `restorePrefs()`; legacy prefs migrate
  (`cost` forced visible, old sort indexes shifted).
