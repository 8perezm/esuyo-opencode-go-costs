"use strict";
/* Opt-in: run with RUN_LIVE=1 npm test. Kept out of the default suite so a
   network outage or an upstream shape change never makes the build red. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadPage } = require("./harness");

const liveTest = process.env.RUN_LIVE === "1" ? test : test.skip;

liveTest("live models endpoint still parses into well-formed rows", async () => {
  const { page } = loadPage(); // offline stub: boot() must not hit the network here
  const res = await fetch("https://opencode.ai/inference/go/v1/models");
  assert.equal(res.ok, true, "HTTP " + res.status);
  const parsed = page.parseSourceModels(await res.text());
  assert.ok(parsed.go.length >= 10);
  for (const row of parsed.go) {
    assert.ok(row.model, "model name present");
    assert.ok(row.input >= 0 && row.output >= 0 && row.cached >= 0, "non-negative prices");
    assert.ok(row.limit === null || row.limit > 0, "limit is null or positive");
  }
});
