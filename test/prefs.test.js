"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadPage } = require("./harness");

function allCols(value = true) {
  const cols = {};
  ["subcost", "cost", "cashpct", "subs", "per10", "allow", "plusvgo", "teamsvgo",
   "maxtok", "input", "cached", "output", "limit"].forEach((k) => { cols[k] = value; });
  return cols;
}

function storedPrefs(overrides = {}) {
  return {
    plan: "go", project: false, tokensM: 100, hit: 97, outPct: 0.8,
    q: "", showFree: true, sortCol: 9, sortDir: -1, cols: allCols(),
    ...overrides,
  };
}

test("fresh defaults: Plus vs Go and Teams vs Go are off, all others on", () => {
  const { page } = loadPage();
  const d = page.defaultPrefs();
  assert.equal(d.cols.plusvgo, false);
  assert.equal(d.cols.teamsvgo, false);
  for (const c of page.COLUMNS) {
    if (c.key !== "plusvgo" && c.key !== "teamsvgo") {
      assert.equal(d.cols[c.key], true, c.key + " should default on");
    }
  }
  assert.equal(d.sortCol, 9);
  assert.equal(d.sortDir, -1);
  assert.equal(d.plan, "go");
});

test("no stored prefs falls back to the new defaults", () => {
  const { page } = loadPage();
  const p = page.loadPrefs();
  assert.equal(p.cols.plusvgo, false);
  assert.equal(p.cols.teamsvgo, false);
  assert.equal(p.cols.input, true);
});

test("v11 prefs with a user-enabled column are honored", () => {
  const prefs = storedPrefs({ cols: { ...allCols(), plusvgo: true, teamsvgo: false } });
  const { page } = loadPage({ storage: { "go-prefs-v11": prefs } });
  const p = page.loadPrefs();
  assert.equal(p.cols.plusvgo, true, "an explicit v11 choice must not be overridden");
  assert.equal(p.cols.teamsvgo, false);
  assert.equal(p.cols.input, true);
});

test("v10 prefs migrate: both comparison columns forced off, other state kept", () => {
  const v10 = storedPrefs({
    plan: "plus", project: true, tokensM: 250, hit: 95, outPct: 1.5,
    q: "glm", showFree: false, sortCol: 7, sortDir: 1, cols: allCols(),
  });
  const { page } = loadPage({ storage: { "go-prefs-v10": v10 } });
  const p = page.loadPrefs();
  assert.equal(p.cols.plusvgo, false);
  assert.equal(p.cols.teamsvgo, false);
  assert.equal(p.cols.input, true, "unrelated columns survive migration");
  assert.equal(p.cols.cost, true, "Cost is forced visible by legacy migration");
  assert.equal(p.plan, "plus");
  assert.equal(p.project, true);
  assert.equal(p.tokensM, 250);
  assert.equal(p.hit, 95);
  assert.equal(p.q, "glm");
  assert.equal(p.showFree, false);
});

test("older legacy prefs still get the sort-index shifts", () => {
  const v8 = storedPrefs({ sortCol: 7, sortDir: 1 });
  const p8 = loadPage({ storage: { "go-prefs-v8": v8 } }).page.loadPrefs();
  assert.equal(p8.sortCol, 9, "v8 index 7 -> 8 (Plus vs Go) -> 9 (Teams vs Go)");

  const v9 = storedPrefs({ sortCol: 8, sortDir: 1 });
  const p9 = loadPage({ storage: { "go-prefs-v9": v9 } }).page.loadPrefs();
  assert.equal(p9.sortCol, 9, "v9 index 8 -> 9 (Teams vs Go)");
});

test("hiddenColIndexes hides the comparison columns even when Project is on", () => {
  const off = loadPage().page;
  const hOff = off.hiddenColIndexes();
  assert.ok(hOff.has(7), "index 7 = Plus vs Go");
  assert.ok(hOff.has(8), "index 8 = Teams vs Go");
  for (const key of off.TOKEN_COLS) {
    const i = off.COLUMNS.findIndex((c) => c.key === key) + 1;
    assert.ok(hOff.has(i), key + " hidden while Project is off");
  }
  assert.equal(hOff.has(9), false, "Max tokens / sub stays visible");

  const prefs = storedPrefs({
    project: true,
    cols: { ...allCols(), plusvgo: false, teamsvgo: false },
  });
  const on = loadPage({ storage: { "go-prefs-v11": prefs } }).page;
  const hOn = on.hiddenColIndexes();
  assert.ok(hOn.has(7));
  assert.ok(hOn.has(8));
  for (const key of on.TOKEN_COLS) {
    const i = on.COLUMNS.findIndex((c) => c.key === key) + 1;
    assert.equal(hOn.has(i), false, key + " visible while Project is on");
  }
});

test("ensureVisibleSort falls back from a hidden comparison column to Max tokens", () => {
  const prefs = storedPrefs({ sortCol: 7, sortDir: 1, cols: { ...allCols(), plusvgo: false } });
  const { page } = loadPage({ storage: { "go-prefs-v11": prefs } });
  page.ensureVisibleSort();
  assert.equal(page.sortCol, 9);
  assert.equal(page.sortDir, -1);
  assert.equal(page.PREFS.sortCol, 9);
});
