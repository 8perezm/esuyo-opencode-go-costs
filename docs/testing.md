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

4. Parser: download the live models API
   (`curl -s "https://opencode.ai/inference/go/v1/models" -o /tmp/models.json`),
   evaluate the pure parser functions in Node (slice the script from
   `function parseModelsApi` to `function readLive` — no DOM stubs needed), and
   assert well-formed rows: ≥ 30 rows, non-empty names, non-negative prices,
   positive-or-null limits. Also assert the proxy envelope
   (`r.jina.ai/.../inference/go/v1/models`) parses to the same row count,
   and that the legacy docs Markdown (`go.md`) now throws
   "pricing table not found" (tables moved to the API). Exercise `refreshFromSource` with stubbed `fetch`
   (direct rejects, proxy resolves) and all-rejecting `fetch` for both failure
   paths (with and without cached `MODELS`).
