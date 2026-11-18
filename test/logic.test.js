"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadPage } = require("./harness");

test("money() formatting", () => {
  const { page } = loadPage();
  assert.equal(page.money(0), "$0.00");
  assert.equal(page.money(0.5), "$0.500");
  assert.equal(page.money(12.75), "$12.75");
});

test("fmtTokens() formatting", () => {
  const { page } = loadPage();
  assert.equal(page.fmtTokens(0), "0.00M");
  assert.equal(page.fmtTokens(1.5e6), "1.50M");
  assert.equal(page.fmtTokens(12.3e6), "12.3M");
  assert.equal(page.fmtTokens(150e6), "150M");
  assert.equal(page.fmtTokens(2.1e9), "2.10B");
  assert.equal(page.fmtTokens(Infinity), "∞");
});

test("isFree(), parsePrice() and parseLimit()", () => {
  const { page } = loadPage();
  assert.equal(page.isFree({ input: 0, cached: 0 }), true);
  assert.equal(page.isFree({ input: 1, cached: 0 }), false);
  assert.equal(page.parsePrice("Free"), 0);
  assert.equal(page.parsePrice("~~$4.00~~ $2.00"), 2);
  assert.equal(page.parseLimit("Unlimited"), null);
  assert.equal(page.parseLimit("$60"), 60);
});

test("currentParams() splits a 100M workload at 97% hit / 0.8% output", () => {
  const { page, sandbox } = loadPage();
  sandbox.document.getElementById("tokens").value = "100";
  sandbox.document.getElementById("hit").value = "97";
  sandbox.document.getElementById("outPct").value = "0.8";
  const r = page.currentParams();
  assert.equal(r.T, 100e6);
  assert.ok(Math.abs(r.h - 0.97) < 1e-12);
  assert.ok(Math.abs(r.p - 0.008) < 1e-12);
  assert.ok(Math.abs(r.inM - 99.2) < 1e-9);
  assert.ok(Math.abs(r.outM - 0.8) < 1e-9);
  assert.ok(Math.abs(r.freshM - 2.976) < 1e-9);
  assert.ok(Math.abs(r.cachedM - 96.224) < 1e-9);
});

test("activeLimit() follows the selected plan and falls back to Go", () => {
  const { page } = loadPage();
  const m = { limit: 60, limitPlus: 180, limitTeams: 90 };
  page.PREFS.plan = "go";
  assert.equal(page.activeLimit(m), 60);
  page.PREFS.plan = "plus";
  assert.equal(page.activeLimit(m), 180);
  page.PREFS.plan = "teams";
  assert.equal(page.activeLimit(m), 90);
  assert.equal(page.activeLimit({ limit: 42 }), 42, "missing plan limit falls back to Go");
});
