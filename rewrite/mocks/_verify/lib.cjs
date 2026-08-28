/* ============================================================
   _verify/lib.cjs — shared gate harness. House standard since
   2026-08-25 (S-std). New gates REQUIRE this; existing gates
   migrate opportunistically, never mid-sprint.

   const { makeGate } = require("./lib.cjs");
   const g = makeGate({ base: process.env.ZEN_BASE, path: "/zen/today.html", id: "S03-today" });
   g.ok("name", cond, "extra");
   ... await g.page.goto(g.url, ...) ...
   g.done();   // prints summary, exits nonzero on failures

   Exports: makeGate, sleep, vis, targetAtLeast, GRAMMAR, cleanCd
   ============================================================ */
const { chromium } = require("playwright-core");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vis = (page, sel) => page.$eval(sel, (el) => {
  const s = getComputedStyle(el);
  return !(s.display === "none" || s.visibility === "hidden") && el.offsetParent !== null;
}).catch(() => false);

async function targetAtLeast(page, sel) {
  return page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el, "::after");
    const slop = st && st.content !== "none" ? {
      v: Math.abs(parseFloat(st.top) || 0) + Math.abs(parseFloat(st.bottom) || 0),
      h: Math.abs(parseFloat(st.left) || 0) + Math.abs(parseFloat(st.right) || 0),
    } : { v: 0, h: 0 };
    return { w: r.width + slop.h, h: r.height + slop.v };
  }).catch(() => ({ w: 0, h: 0 }));
}

/* duration grammar: "3h 24m" | "45m" | "<1m" (+ optional "NNs" only on news T-15m) */
const GRAMMAR = /^(?:(\d+)h )?\d+m( \d{2}s)?$|^<1m$/;
const cleanCd = (s) => s.replace(/^in /, "").replace(/^[a-z]+ ·\s*/i, "").trim();

function makeGate({ base, path, id, viewport } = {}) {
  const BASE = (base || process.env.ZEN_BASE || "https://mock.1ed.ge").replace(/\/$/, "");
  const url = BASE + path;
  const state = { pass: 0, fail: 0, failures: [], errors: [], browser: null, page: null };

  const ok = (name, cond, extra) => {
    if (cond) { state.pass++; console.log(`  ✓ ${name}`); }
    else { state.fail++; state.failures.push(name); console.log(`  ✗ ${name}${extra ? " — " + extra : ""}`); }
  };

  async function open() {
    state.browser = await chromium.launch();
    const ctx = await state.browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
    state.page = await ctx.newPage();
    state.page.on("pageerror", (e) => state.errors.push(String(e)));
    return state.page;
  }

  /* standard shell block every gate re-implements by hand today */
  async function shell({ titleIncludes, sprintId, css = [], cssV = "" }) {
    console.log("shell");
    const resp = await state.page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    ok("200 on page", resp.status() === 200, String(resp.status()));
    if (titleIncludes) ok(`title reads ${titleIncludes}`, (await state.page.title()).includes(titleIncludes));
    if (sprintId) {
      const raw = await (await state.page.request.get(url)).text();
      ok("sprint id comment present", raw.includes(sprintId));
    }
    ok("feedback annotator mounted", await state.page.$eval("#fb-toggle", () => true).catch(() => false));
    for (const asset of css) {
      const r = await state.page.request.get(`${BASE}/st/css/${asset}${cssV ? `?v=${cssV}` : ""}`);
      ok(`css ${asset} serves 200`, r.status() === 200);
    }
    return resp;
  }

  async function noColorLiterals(cssFile, cssV) {
    const css = await (await state.page.request.get(`${BASE}/st/css/${cssFile}?v=${cssV}`)).text();
    const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
    ok(`${cssFile} zero color literals`, !/#[0-9a-fA-F]{3,8}\b/.test(body) && !/rgba?\(/i.test(body));
  }

  async function done() {
    if (state.browser) await state.browser.close().catch(() => {});
    console.log(`\n${state.pass} passed · ${state.fail} failed`);
    if (state.fail) { console.log("failures:\n - " + state.failures.join("\n - ")); process.exit(1); }
  }

  return { BASE, url, ok, open, shell, noColorLiterals, done, state, sleep, vis, targetAtLeast };
}

module.exports = { makeGate, sleep, vis, targetAtLeast, GRAMMAR, cleanCd };
