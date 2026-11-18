"use strict";
/* Loads the real <script> from index.html into a vm with browser stubs, so the
   tests exercise the page's own functions rather than copies of them. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const HTML_PATH = path.join(__dirname, "..", "index.html");
const HTML = fs.readFileSync(HTML_PATH, "utf8");
const SCRIPT = /<script>([\s\S]*?)<\/script>/.exec(HTML);
if (!SCRIPT) throw new Error("no inline <script> found in index.html");

// Fixed clock so multiplier notes that depend on "today" are deterministic.
const FIXED_ISO = "2025-06-01T00:00:00.000Z";
const FIXED_NOW = Date.parse(FIXED_ISO);
class FixedDate extends Date {
  constructor(...args) {
    if (args.length === 0) super(FIXED_ISO);
    else super(...args);
  }
  static now() { return FIXED_NOW; }
}

function decode(s) {
  return String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

// Minimal DOMParser double: enough for parseSourceHtml() to walk
// [data-plan-panel] / [slot] panels, tables, rows and cells. It only needs to
// understand the well-formed fixture in test/fixtures/plans.html.
function makeDomParser() {
  class El {
    constructor(tag, attrs = {}) {
      this.tag = String(tag).toLowerCase();
      this.attrs = attrs;
      this.children = [];
    }
    get textContent() {
      return this.children.map((c) => (typeof c === "string" ? c : c.textContent)).join("");
    }
    _matches(sel) {
      let m = /^\[data-plan-panel="([^"]+)"\]$/.exec(sel);
      if (m) return this.attrs["data-plan-panel"] === m[1];
      m = /^\[slot="([^"]+)"\]$/.exec(sel);
      if (m) return this.attrs.slot === m[1];
      return this.tag === sel.toLowerCase();
    }
    _all(sel, out) {
      for (const c of this.children) {
        if (typeof c === "string") continue;
        if (c._matches(sel)) out.push(c);
        c._all(sel, out);
      }
      return out;
    }
    querySelectorAll(sel) { return this._all(sel, []); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  }

  function parseHtml(html) {
    const root = new El("root");
    const stack = [root];
    const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)\s*(\/?)>|([^<]+)/g;
    let m;
    while ((m = re.exec(String(html)))) {
      if (m[5] !== undefined) {
        if (decode(m[5])) stack[stack.length - 1].children.push(decode(m[5]));
        continue;
      }
      const closing = m[1] === "/";
      const tag = m[2].toLowerCase();
      if (closing) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const attrs = {};
      const ar = /([\w-]+)\s*=\s*"([^"]*)"/g;
      let a;
      while ((a = ar.exec(m[3] || ""))) attrs[a[1]] = a[2];
      const el = new El(tag, attrs);
      stack[stack.length - 1].children.push(el);
      if (m[4] !== "/") stack.push(el);
    }
    return root;
  }

  return class DOMParser {
    parseFromString(text) { return parseHtml(text); }
  };
}

function fakeElement(tag = "div") {
  return {
    tag,
    style: {},
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    value: "",
    checked: false,
    disabled: false,
    innerHTML: "",
    textContent: "",
    title: "",
    firstChild: { textContent: "" },
    children: [],
    rows: [],
    cells: [],
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {},
    removeEventListener() {},
    removeAttribute() {},
    setAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

function makeLocalStorage(seed = {}) {
  const map = new Map(
    Object.entries(seed).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])
  );
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    get length() { return map.size; },
  };
}

function makeDocument() {
  const byId = new Map();
  return {
    getElementById(id) {
      if (!byId.has(id)) byId.set(id, fakeElement());
      return byId.get(id);
    },
    querySelector(sel) {
      const m = /value="([^"]+)"/.exec(sel); // plan radio lookup in restorePrefs()
      return m ? Object.assign(fakeElement("input"), { value: m[1] }) : null;
    },
    querySelectorAll() { return []; },
    createElement(tag) { return fakeElement(tag); },
    createTextNode(text) { return { textContent: String(text) }; },
    addEventListener() {},
    body: fakeElement("body"),
  };
}

const EXPOSED = [
  "defaultPrefs", "loadPrefs", "savePrefs", "COLUMNS", "TOKEN_COLS", "PLANS",
  "hiddenColIndexes", "applyColVisibility", "ensureVisibleSort", "updatePlanHeaders",
  "render", "buildColChooser", "applyProjectVisibility", "restorePrefs", "boot",
  "currentParams", "esc", "money", "fmtTokens", "isFree", "activeLimit", "activePrice",
  "planOf", "parsePrice", "parseLimit", "cleanModelName", "rowsFromCells",
  "parseSourceMarkdown", "parseSourceHtml", "parseSourceModels", "mergePlanRows",
  "readLive", "refreshFromSource", "showError", "applyLiveData", "setFeed",
  "setSrcStatus", "ageText", "sortTbody", "paintSort",
].join(", ");

const TAIL = `
;globalThis.__page = {
  ${EXPOSED},
  get MODELS() { return MODELS; }, set MODELS(v) { MODELS = v; },
  get PREFS() { return PREFS; },
  get sortCol() { return sortCol; }, set sortCol(v) { sortCol = v; },
  get sortDir() { return sortDir; }, set sortDir(v) { sortDir = v; },
};`;

/**
 * Create a fresh page instance. Each call gets its own vm so PREFS (computed
 * once at load time) reflects the supplied stored prefs.
 *
 * @param {object}  opts
 * @param {object}  opts.storage     raw localStorage contents (keys -> object|string)
 * @param {function} opts.fetchImpl  fetch stub used by refreshFromSource()
 * @returns {{page: object, sandbox: object, storage: object}}
 */
function loadPage({ storage = {}, fetchImpl = async () => { throw new Error("offline"); } } = {}) {
  const sandbox = {
    console,
    localStorage: makeLocalStorage(storage),
    document: makeDocument(),
    fetch: fetchImpl,
    Date: FixedDate,
    DOMParser: makeDomParser(),
    setTimeout,
    clearTimeout,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(SCRIPT[1] + TAIL, context, { filename: "index.html<script>" });
  return { page: sandbox.__page, sandbox, storage: sandbox.localStorage };
}

module.exports = { loadPage, FIXED_NOW, FIXED_ISO };
