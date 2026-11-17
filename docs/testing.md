# Testing

1. Syntax-check the script:

   ```sh
   python -c "import re;print(re.search(r'<script>(.*)</script>',open('index.html').read(),re.S).group(1))" > /tmp/check.js && node --check /tmp/check.js
   ```

2. Functional check: run the page logic in Node with stubbed
   `document`/`localStorage` (no `fetch` needed), pre-seed `go-prefs-v10`,
   call the header click handlers, and assert on `tbody.innerHTML`, header
   arrows (`▲/▼/↕`), and stored prefs. Verify `ensureVisibleSort()` falls back
   to Max tokens / sub when the stored sort targets a hidden Project column.

3. Spot-check math (h = 97%, T = 100M total, 0.8% out): GLM-5.3-Flash cost
   $3.73, sub cost ≈ $0.62 on Go ($3.73 ÷ $60 × $10) and ≈ $0.83 on Go Plus
   ($3.73 ÷ $180 × $40); at 0% out it reproduces the old input-only $3.36.
   Session scale (11.9M total, 0.99% out): Muse Spark 1.3 ≈ $0.082.

4. Sources: fetch the models endpoint
   (`curl -s "https://opencode.ai/inference/go/v1/models" -o /tmp/go-models.json`)
   and evaluate `parseSourceModels` in Node (slice the script from
   `function parsePrice` to `function readLive` — no DOM stubs needed). Assert
   well-formed rows: ≥ 30 rows, non-empty names, non-negative prices, and
   per-plan allowances (`go` > 0 for paid models, `null` for free rows). Also
   download the Markdown fallback (`curl -s "https://opencode.ai/docs/console/go.md" -o /tmp/go.md`)
   and check `parseSourceMarkdown` still returns well-formed rows if the docs
   regain pricing tables. Exercise `refreshFromSource` with stubbed `fetch`
   (direct endpoint rejects, proxy resolves) and all-rejecting `fetch` for both
   failure paths (with and without cached `MODELS`).
