"use strict";
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadPage } = require("./harness");

const read = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
const MODELS_JSON = read("models.json");
const MD = read("go.md");
const HTML = read("plans.html");

test("parseSourceModels parses every plan, free rows and multiplier variants", () => {
  const { page } = loadPage();
  const r = page.parseSourceModels(MODELS_JSON);
  assert.ok(r.go.length >= 10);
  assert.ok(r.plus.length >= 10, "Go Plus rows parsed");
  assert.ok(r.teams.length >= 10, "Go Teams rows parsed");

  const free = r.go.find((x) => x.model === "Free Model");
  assert.equal(free.limit, null, "free models have an unlimited allowance");
  assert.equal(free.input, 0);

  const peak = r.go.filter((x) => x.model.startsWith("Peak Model"));
  assert.equal(peak.length, 2, "recurring peak expands into Off-Peak + Peak rows");
  const off = peak.find((x) => x.model.includes("Off-Peak"));
  const on = peak.find((x) => x.model.includes("Peak") && !x.model.includes("Off-Peak"));
  assert.equal(off.input, 1);
  assert.equal(on.input, 2, "Peak price is doubled");
  assert.equal(off.note, "1.5× from 2030-01-01", "scheduled change is noted (fixed clock)");
});

test("mergePlanRows falls back to Go when a plan omits a model", () => {
  const { page } = loadPage();
  const r = page.parseSourceModels(MODELS_JSON);
  const merged = page.mergePlanRows(r.go, r.plus, r.teams);
  const noPlus = merged.find((x) => x.model === "No Plus Model");
  assert.equal(noPlus.limit, 70);
  assert.equal(noPlus.limitPlus, 70, "missing Go Plus allowance mirrors Go");
  assert.equal(noPlus.limitTeams, 70, "missing Go Teams allowance mirrors Go");
  const normal = merged.find((x) => x.model === "Alpha");
  assert.equal(normal.limitPlus, 180);
  assert.equal(normal.limitTeams, 90);
});

test("parseSourceMarkdown reads all three tables and price formats", () => {
  const { page } = loadPage();
  const r = page.parseSourceMarkdown(MD);
  assert.equal(r.go.length, 10);
  assert.equal(r.plus.length, 10);
  assert.equal(r.teams.length, 10);
  // Rows come from the vm realm, so compare fields rather than prototypes.
  assert.equal(r.go[0].model, "Alpha");
  assert.equal(r.go[0].input, 1);
  assert.equal(r.go[0].output, 2);
  assert.equal(r.go[0].cached, 0.1);
  assert.equal(r.go[0].limit, 60);
  assert.equal(r.go.find((x) => x.model === "Free Model").limit, null, "Unlimited -> null");
  assert.equal(r.go.find((x) => x.model === "Discount Model").input, 2, "struck-through price uses the current one");
  assert.equal(r.plus[0].limit, 180);
  assert.equal(r.teams[0].limit, 90);
});

test("parseSourceHtml picks the Go / Go Plus / Go Teams panels", () => {
  const { page } = loadPage();
  const r = page.parseSourceHtml(HTML);
  assert.equal(r.go.length, 10);
  assert.equal(r.plus.length, 10);
  assert.equal(r.teams.length, 10);
  assert.equal(r.go[0].limit, 60);
  assert.equal(r.plus[0].limit, 180);
  assert.equal(r.teams[0].limit, 90);
  assert.equal(r.go.find((x) => x.model === "Free Model").limit, null);
});

test("refreshFromSource falls back to the text-proxy when the direct endpoint fails", async () => {
  const seen = [];
  const { page, sandbox } = loadPage({
    fetchImpl: async (url) => {
      seen.push(url);
      if (url.includes("inference/go/v1/models") && !url.includes("r.jina.ai")) {
        throw new Error("CORS blocked");
      }
      return { ok: true, status: 200, text: async () => MODELS_JSON };
    },
  });
  await page.refreshFromSource();
  assert.ok(page.MODELS.length >= 10, "models loaded from the proxy");
  assert.ok(seen.some((u) => u.includes("r.jina.ai")), "proxy was attempted");
  assert.equal(sandbox.document.getElementById("feedBadge").dataset.state, "ok");
});

test("refreshFromSource keeps cached prices when every source fails", async () => {
  const { page, sandbox } = loadPage();
  const parsed = page.parseSourceModels(MODELS_JSON);
  page.applyLiveData(parsed.go, parsed.plus, parsed.teams, "fixture");
  const before = page.MODELS.length;

  await page.refreshFromSource();
  assert.equal(page.MODELS.length, before, "last good data is retained");
  assert.equal(sandbox.document.getElementById("feedBadge").dataset.state, "warn");
  assert.match(sandbox.document.getElementById("srcStatus").textContent, /Could not refresh/);
});

test("refreshFromSource shows an error when every source fails with no cache", async () => {
  const { page, sandbox } = loadPage();
  await page.refreshFromSource();
  assert.equal(page.MODELS.length, 0);
  assert.equal(sandbox.document.getElementById("feedBadge").dataset.state, "err");
  assert.match(sandbox.document.getElementById("body").innerHTML, /Could not load live prices/);
});
