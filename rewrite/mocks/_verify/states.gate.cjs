#!/usr/bin/env bun
/* ============================================================
   _verify/states.gate.cjs — S09 states pass · live-URL gate.
   Verifies the state matrix documented on /design/ (mocks index):
   empties · skeletons · error notes · edge dates (holiday-monday
   label fix, labor day, 17:00 ct rollover) · long-content stress ·
   dynamic type · sessions-rail clip regression (C13 deferral).
   Harness: ./lib.cjs (house standard). Run: sh docs/design/gate.sh
   NOTE: ~95 checks over ~30 page loads — pass GATE_TIMEOUT=600.
   ============================================================ */
const { makeGate, sleep, vis, targetAtLeast } = require("./lib.cjs");

const g = makeGate({ path: "/", id: "S09-states" });
const BASE = g.BASE;
const page = () => g.state.page;

/* route-delay helper: holds /st/data/news.json back so the boot
   skeleton state is observable — the honest cold-load path */
async function delayNews(p, ms) {
  await p.route("**/st/data/news.json*", async (route) => {
    await sleep(ms);
    return route.continue();
  });
}
async function text(p, sel) {
  return p.$eval(sel, (el) => el.textContent.trim()).catch(() => "");
}
async function noHScroll(p) {
  return p.evaluate(() =>
    document.scrollingElement.scrollWidth <= window.innerWidth + 1);
}
const PHONE = { width: 390, height: 844 };

/* rapid-fire navigations can hit a stalled keep-alive socket — one retry */
async function nav(p2, url, opts) {
  try { return await p2.goto(url, opts); }
  catch (e) { return await p2.goto(url, { ...opts, waitUntil: "load" }); }
}

(async () => {
  await g.open();
  const p = page();

  /* ---------------- primitives ---------------- */
  console.log("primitives");
  const baseCss = await (await p.request.get(`${BASE}/st/css/base?v=c16`)).text();
  g.ok("base.css serves", baseCss.length > 1000);
  g.ok("base.css has .skel primitive", baseCss.includes(".skel"));
  g.ok("base.css has .note primitive", baseCss.includes(".note-err") && baseCss.includes(".note-act"));
  const frameCss = await (await p.request.get(`${BASE}/st/css/frame?v=c16`)).text();
  g.ok("frame rail uses minmax(0,1fr)", frameCss.includes("repeat(3, minmax(0, 1fr))"));

  /* ---------------- matrix page: every link resolves ---------------- */
  console.log("state matrix (mocks index)");
  await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 15000 });
  g.ok("matrix section present", await vis(p, "#matrix"));
  const matrixHrefs = await p.$$eval("#matrix a.link", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  g.ok("matrix links >= 25 demos", matrixHrefs.length >= 25, String(matrixHrefs.length));
  let dead = 0;
  for (const href of matrixHrefs) {
    const r = await p.request.get(`${BASE}/${href}`);
    if (r.status() !== 200) { dead++; console.log(`    dead: ${href} -> ${r.status}`); }
  }
  g.ok("every matrix link serves 200", dead === 0, `${dead} dead`);

  /* ---------------- empties ---------------- */
  console.log("empty states");
  await p.goto(`${BASE}/zen/index.html?view=empty`, { waitUntil: "domcontentloaded" });
  g.ok("index view=empty shows first-capture cta", await vis(p, "#empty-compose"));

  await p.goto(`${BASE}/zen/today.html?day=first`, { waitUntil: "domcontentloaded" });
  await sleep(250);
  g.ok("today day=first shows empty line", await p.$eval("#tlist .empty", (el) => el.textContent.includes("no trades yet")).catch(() => false));
  g.ok("today day=first hides expand-all", !(await vis(p, "#tx-all")));

  await p.goto(`${BASE}/zen/evening.html?queue=empty`, { waitUntil: "domcontentloaded" });
  g.ok("evening queue=empty copy", (await text(p, "#q-box") || await p.$eval("body", (b) => b.textContent)).includes("nothing owed"));

  await p.goto(`${BASE}/zen/accounts.html?empty=1`, { waitUntil: "domcontentloaded" });
  g.ok("accounts empty=1 copy", (await p.$eval("body", (b) => b.textContent)).includes("no accounts yet"));

  await p.goto(`${BASE}/zen/library.html?empty=1`, { waitUntil: "domcontentloaded" });
  g.ok("library empty=1 pressed", await p.$eval('#empty-seg [data-e="empty"]', (b) => b.getAttribute("aria-pressed") === "true").catch(() => false));

  await p.goto(`${BASE}/zen/media.html?empty=1`, { waitUntil: "domcontentloaded" });
  g.ok("media empty=1 copy", (await p.$eval("body", (b) => b.textContent)).includes("no media yet"));

  await p.goto(`${BASE}/zen/settings.html?pk=0`, { waitUntil: "domcontentloaded" });
  g.ok("settings pk=0 copy", (await p.$eval("body", (b) => b.textContent)).includes("no passkeys"));

  await p.goto(`${BASE}/zen/rituals.html?rituals=none`, { waitUntil: "domcontentloaded" });
  g.ok("rituals=none: fresh day (0 of N done)", (await text(p, "#rt-count")).startsWith("0 of"));

  await p.goto(`${BASE}/public/index.html?day=empty`, { waitUntil: "domcontentloaded" });
  g.ok("public day=empty fallback banner", await vis(p, "#fallback"));

  /* ---------------- loading skeletons (delayed news route) ---------------- */
  console.log("loading skeletons");
  await delayNews(p, 1100);
  await p.goto(`${BASE}/zen/index.html`, { waitUntil: "domcontentloaded" });
  g.ok("index boot: ev skeleton visible", await vis(p, "#ev-body .skel"));
  await sleep(1400);
  g.ok("index after load: skeleton replaced", !(await p.$eval("#ev-body", (b) => !!b.querySelector(".skel"))));

  await p.goto(`${BASE}/zen/today.html`, { waitUntil: "domcontentloaded" });
  g.ok("today boot: ev skeleton visible", await vis(p, "#ev-box .skel"));
  await sleep(1400);
  g.ok("today after load: skeleton replaced", !(await p.$eval("#ev-box", (b) => !!b.querySelector(".skel"))));

  await p.goto(`${BASE}/public/index.html`, { waitUntil: "domcontentloaded" });
  g.ok("public boot: news skeleton visible", await vis(p, "#news-rows .skel"));
  await sleep(1400);
  g.ok("public after load: news rows land", (await p.$$("#news-rows .news-row[data-ms]")).length > 0);
  await p.unrouteAll();

  /* ---------------- error notes ---------------- */
  console.log("error states");
  await p.goto(`${BASE}/zen/index.html?err=news`, { waitUntil: "domcontentloaded" });
  g.ok("index err=news note visible", await vis(p, "#ev-body .note-warn"));
  g.ok("index note copy is one line + period", ((await text(p, "#ev-body .note-warn")).match(/calendar unavailable[^.]*\./) || []).length === 1);
  const t1 = await targetAtLeast(p, "#ev-body .note-act");
  g.ok("note-act target >= 44pt", t1.h >= 44 || t1.w >= 44, JSON.stringify(t1));
  await delayNews(p, 1100);
  await p.click("#ev-retry");
  g.ok("index retry: skeleton shows first", await vis(p, "#ev-body .skel"));
  await sleep(1500);
  await p.unrouteAll();
  g.ok("index retry: rows land", (await p.$$("#ev-body .ev-row")).length > 0 || (await p.$$("#ev-body .empty")).length > 0);

  await p.goto(`${BASE}/zen/today.html?err=news`, { waitUntil: "domcontentloaded" });
  g.ok("today err=news note visible", await vis(p, "#ev-box .note-warn"));
  g.ok("today note scopes honestly (trades unaffected)", (await text(p, "#ev-box .note-warn")).includes("unaffected"));

  await p.goto(`${BASE}/public/index.html?err=news`, { waitUntil: "domcontentloaded" });
  g.ok("public err=news note visible", await vis(p, "#news-rows .note-warn"));

  await p.goto(`${BASE}/zen/composer.html?err=ai`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  g.ok("composer err=ai: read fails with note", await vis(p, "#shots-note .note-err"));
  g.ok("composer ai note offers retry", (await text(p, "#ai-retry")) === "retry");
  await p.click("#ai-retry");
  await sleep(1300);
  g.ok("composer ai retry succeeds into diff dialog", await p.$eval("#diff-dlg", (d) => d.open).catch(() => false));

  await p.goto(`${BASE}/zen/composer.html?err=upload`, { waitUntil: "domcontentloaded" });
  g.ok("composer err=upload note visible", await vis(p, "#shots-note .note-warn"));
  g.ok("composer upload note: kept locally", (await text(p, "#shots-note")).includes("kept locally"));
  await p.click("#up-retry");
  await sleep(1300);
  g.ok("composer upload retry lands ok note", await p.$eval("#shots-note .note-ok", () => true).catch(() => false));

  await p.goto(`${BASE}/zen/evening.html?err=csv`, { waitUntil: "domcontentloaded" });
  g.ok("evening err=csv parse-fail note", await vis(p, "#csv-retry"));
  g.ok("evening csv note honest copy", (await p.$eval("body", (b) => b.textContent)).includes("didn't parse"));
  await p.click("#csv-retry");
  g.ok("evening csv retry back to dropzone", await vis(p, "#dz"));

  await p.goto(`${BASE}/zen/evening.html?err=save`, { waitUntil: "domcontentloaded" });
  await p.click("#log-btn");
  await sleep(250);
  g.ok("evening err=save conflict note", await vis(p, "#refl-conflict"));
  await p.click("#refl-keep");
  await sleep(250);
  g.ok("evening keep-mine logs reflection", (await text(p, "#refl-chip")) === "logged");

  /* ---------------- edge dates (cme master clock) ---------------- */
  console.log("edge dates");
  await p.goto(`${BASE}/zen/index.html?at=2027-07-05T22:00`, { waitUntil: "domcontentloaded" });
  await sleep(300);
  g.ok("holiday MONDAY reads 'cme · holiday' (was: weekend — C14 fix)", (await text(p, "#mkt-label")) === "cme · holiday");
  g.ok("mock-time chip shows under ?at", await p.$eval("#sim-chip", (el) => getComputedStyle(el).display !== "none").catch(() => false));

  await p.goto(`${BASE}/zen/index.html?at=2026-11-26T22:00`, { waitUntil: "domcontentloaded" });
  await sleep(300);
  g.ok("holiday THURSDAY still 'cme · holiday'", (await text(p, "#mkt-label")) === "cme · holiday");

  await p.goto(`${BASE}/zen/index.html?at=2026-09-07T22:00`, { waitUntil: "domcontentloaded" });
  await sleep(300);
  g.ok("labor day now trades (early halt)", (await text(p, "#mkt-label")) === "cme · open");
  g.ok("labor day closes in 3h 0m (12:00 ct halt)", (await text(p, "#mkt-cd")) === "3h 0m");

  await p.goto(`${BASE}/zen/index.html?at=2026-09-05T14:00`, { waitUntil: "domcontentloaded" });
  await sleep(300);
  g.ok("saturday reads closed · weekend", (await text(p, "#mkt-label")) === "cme · closed" && (await text(p, "#next-change")).includes("weekend"));

  await p.goto(`${BASE}/zen/index.html?at=2026-11-28T02:30`, { waitUntil: "domcontentloaded" });
  await sleep(300);
  g.ok("early-close friday counts down to 13:15 ct", (await text(p, "#mkt-label")) === "cme · open" && (await text(p, "#mkt-cd")) === "45m");

  await p.goto(`${BASE}/zen/index.html?at=2026-09-01T05:58`, { waitUntil: "domcontentloaded" });
  await sleep(300);
  g.ok("rollover 05:58: monday day, 2m left", (await text(p, "#mkt-cd")) === "2m");
  await p.goto(`${BASE}/zen/index.html?at=2026-09-01T06:01`, { waitUntil: "domcontentloaded" });
  await sleep(300);
  g.ok("rollover 06:01: fresh cme day ~23h", (await text(p, "#mkt-label")) === "cme · open" && (await text(p, "#mkt-cd")).startsWith("22h"));

  await p.goto(`${BASE}/public/index.html?at=2027-07-05T22:00`, { waitUntil: "domcontentloaded" });
  await sleep(300);
  g.ok("public holiday monday: strip says holiday", (await text(p, "#ms-state")).includes("holiday"));

  await p.goto(`${BASE}/zen/today.html?at=2027-07-05T22:00`, { waitUntil: "domcontentloaded" });
  await sleep(300);
  g.ok("today holiday monday: 'cme · holiday'", (await text(p, "#mkt-label")) === "cme · holiday");

  /* ---------------- long-content stress ---------------- */
  console.log("long-content stress");
  await p.goto(`${BASE}/zen/today.html?stress=trades`, { waitUntil: "domcontentloaded" });
  await sleep(300);
  const rows = await p.$$("#tlist .trow-wrap");
  g.ok("40-trade day renders 40 rows", rows.length === 40, String(rows.length));
  g.ok("facts count reads 40 trades", (await text(p, "#fv-trades")).includes("40"));
  const dayR = await text(p, "#day-r-cap");
  g.ok("day r computed over 40 rows", /^\u0044ay [+\u2212]/.test(dayR) || dayR.startsWith("day +") || dayR.startsWith("day \u2212"), dayR);

  await p.goto(`${BASE}/zen/today.html?stress=shots`, { waitUntil: "domcontentloaded" });
  await p.click("#tlist .trow-wrap .trow");
  await sleep(350);
  const shots = await p.$$("#tlist .trow-wrap.is-open .tk-shot");
  g.ok("12-shot ticket renders 12 thumbs", shots.length === 12, String(shots.length));

  await p.goto(`${BASE}/zen/evening.html?stress=reflect`, { waitUntil: "domcontentloaded" });
  const words = await p.$eval("#refl-ta", (el) => el.value.split(/\s+/).length).catch(() => 0);
  g.ok("2k-word reflection prefilled", words >= 1800, `${words} words`);

  /* ---------------- a11y: dynamic type + phone layout ---------------- */
  console.log("a11y / phone");
  const phoneCtx = await g.state.browser.newContext({ viewport: PHONE });
  const ph = await phoneCtx.newPage();
  ph.on("pageerror", (e) => g.state.errors.push(String(e)));

  for (const [name, url] of [
    ["index", `${BASE}/zen/index.html?dt=1.2`],
    ["today", `${BASE}/zen/today.html?dt=1.2`],
    ["composer", `${BASE}/zen/composer.html?dt=1.2`],
    ["public", `${BASE}/public/index.html?dt=1.2`],
  ]) {
    await nav(ph, url, { waitUntil: "domcontentloaded" });
    await sleep(350);
    const fs = await ph.$eval("html", (el) => getComputedStyle(el).fontSize);
    g.ok(`${name} dt=1.2 root 120%`, fs === "19.2px", fs);
    g.ok(`${name} dt=1.2 no h-scroll @390`, await noHScroll(ph));
  }
  await ph.goto(`${BASE}/zen/today.html?stress=trades`, { waitUntil: "domcontentloaded" });
  await sleep(400);
  g.ok("40-trade day: no h-scroll @390", await noHScroll(ph));

  /* dynamic type across the WHOLE program — secondary pages too */
  for (const [name, url] of [
    ["rituals", `${BASE}/zen/rituals.html?dt=1.2`],
    ["accounts", `${BASE}/zen/accounts.html?dt=1.2`],
    ["library", `${BASE}/zen/library.html?dt=1.2`],
    ["media", `${BASE}/zen/media.html?dt=1.2`],
    ["settings", `${BASE}/zen/settings.html?dt=1.2`],
  ]) {
    await nav(ph, url, { waitUntil: "domcontentloaded" });
    await sleep(300);
    const fs = await ph.$eval("html", (el) => getComputedStyle(el).fontSize);
    g.ok(`${name} dt=1.2 root 120%`, fs === "19.2px", fs);
    g.ok(`${name} dt=1.2 no h-scroll @390`, await noHScroll(ph));
  }

  /* a11y: every tappable button carries a name (VoiceOver spot check,
     mechanized) — textless buttons must have aria-label/labelledby/title */
  const ALL_PAGES = ["/", "/zen/", "/zen/today.html", "/zen/composer.html", "/zen/evening.html",
    "/zen/rituals.html", "/zen/accounts.html", "/zen/library.html", "/zen/media.html",
    "/zen/settings.html", "/public/index.html"];
  for (const pg of ALL_PAGES) {
    await nav(ph, BASE + pg, { waitUntil: "domcontentloaded" });
    await sleep(250);
    const unlabeled = await ph.evaluate(() =>
      [...document.querySelectorAll("button")].filter((b) => {
        if ((b.textContent || "").trim()) return false;
        if (b.getAttribute("aria-label") || b.getAttribute("aria-labelledby") || b.getAttribute("title")) return false;
        return b.getClientRects().length > 0;   /* rendered (closed devrail children skipped) */
      }).map((b) => b.id || b.className));
    g.ok(`icon buttons labeled · ${pg}`, unlabeled.length === 0, unlabeled.join(", ").slice(0, 80));
  }

  /* keyboard focus: first tab stop is a control and the glow halo renders */
  await ph.goto(`${BASE}/zen/index.html`, { waitUntil: "domcontentloaded" });
  await ph.keyboard.press("Tab");
  const fv = await ph.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName ?? "", fv: el?.matches(":focus-visible") ?? false,
             ring: el ? getComputedStyle(el).boxShadow : "none" };
  });
  g.ok("first tab stop is a control", /BUTTON|A|INPUT|SUMMARY|SELECT|TEXTAREA/.test(fv.tag), fv.tag);
  g.ok("focus-visible glow halo renders", fv.fv && fv.ring !== "none", fv.ring.slice(0, 60));

  /* S09 consistency audit: hidden means hidden (the mock-time chip used
     to render on the LIVE clock — author display beat the UA default) */
  await p.goto(`${BASE}/zen/index.html`, { waitUntil: "domcontentloaded" });
  await sleep(300);
  g.ok("live clock: no mock-time chip", await p.$eval("#sim-chip", (el) => getComputedStyle(el).display === "none").catch(() => false));

  /* sessions-rail clip regression (C13 deferral): NYC inside viewport */
  await ph.goto(`${BASE}/zen/index.html`, { waitUntil: "domcontentloaded" });
  await sleep(400);
  const nycRight = await ph.$eval("#sess-nyc", (el) => el.getBoundingClientRect().right).catch(() => 9999);
  g.ok("sessions rail: NYC right edge <= 390 @390px", nycRight <= 391, String(nycRight));

  await phoneCtx.close();

  g.ok("zero page errors", g.state.errors.length === 0, g.state.errors.join(" | ").slice(0, 200));
  await g.done();
})().catch((e) => { console.error("gate crashed:", e); process.exit(1); });
