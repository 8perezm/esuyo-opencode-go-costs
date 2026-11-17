# Developing

## No price maintenance

There is no price list to edit. New models, price changes, and allowance
changes in the source endpoint flow in automatically. Only touch the parser if
the source changes shape (e.g. a new price field in `parseSourceModels`, or
renamed columns in `rowsFromCells`).

## Add a column

1. Append to `COLUMNS` (`{ key, label }`).
2. Add a `<th>` (add `class="proj"` for workload columns, `class="ref"` for
   reference price columns).
3. Emit the `<td>` in `render()` (same class; add `data-val` with the raw
   number when display text has M/B/× suffixes).
4. Bump `colspan` on the loading row.

Saved prefs default new columns to visible.

## Change defaults

Edit `defaultPrefs()`: `plan: "go"`, `tokensM: 100, hit: 97, outPct: 0.8`,
`q: ""`, `showFree: true`, all columns on, sort = Max tokens / sub descending
(`sortCol: 9, sortDir: -1`).

## Styling

Plain CSS in `<style>`; Rubik via Google Fonts. Full-width layout, no card
wrapper. Active sort header uses `th.sorted`. Project columns: `th.proj`
(`#14365f`) / `td.proj` (`#eef4ff`, even `#e2ecfd`, hover `#d7e6fd`).
Reference columns: `th.ref` / `td.ref` grey.

Helpers: `money(n)` for $ amounts, `fmtTokens(n)` for M/B counts.
