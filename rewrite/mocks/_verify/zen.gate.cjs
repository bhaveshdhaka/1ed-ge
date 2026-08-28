// S01 zen frame — live-URL verification gate (R2.4 standing gate, mechanized)
// Deps: npm i playwright && npx playwright install chromium  (run anywhere with network)
// Usage: node zen.gate.cjs   → asserts against https://mock.1ed.ge/zen/ (LIVE bytes)
// (ZEN_BASE env overrides target — local stand-in server friendly)
// 58 gates: stylesheet parse · computed-style probes · clock tick · shell column
// width on desktop · strip snap/month-ticks/long-press · virtual-time freeze +
// scenario matrix (tok/lunch/lon/ny/halt/wknd/half) · sessions rail states ·
// events tape (hero colour+grammar, day/wk accordion, band pins) · palette suite ·
// theme cycle · 320px overflow. ALL GREEN before any handover.

const { chromium } = require("playwright-core");
const BASE = process.env.ZEN_BASE || "https://mock.1ed.ge/zen/";

(async () => {
  const b = await chromium.launch();
  const fails = [];
  let n = 0;
  const ok = (name, cond, detail = "") => {
    n++;
    console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " · " + detail : ""}`) ||
      (!cond && fails.push(name));
  };

  // ---------- mobile pass (iPhone-ish: touch, retina, 390×844) ----------
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark" });
  const errors = [];
  m.on("console", x => x.type() === "error" && !/favicon/i.test(x.text) && errors.push(x.text()));
  m.on("pageerror", e => errors.push("PAGEERROR: " + e.message));
  await m.goto(BASE, { waitUntil: "networkidle" });

  // stylesheets parsed + canon applied
  const sheets = await m.$$eval("link[rel=stylesheet]", ls => ls.filter(l => !l.disabled).map(l => ({ h: l.getAttribute("href"), ok: !!l.sheet })));
  ok("all stylesheets parsed", sheets.every(s => s.ok), sheets.map(s => `${s.h}:${s.ok ? "ok" : "NULL"}`).join(" "));
  const pr = await m.evaluate(() => ({
    bodyBg: getComputedStyle(document.body).backgroundColor,
    brandFont: getComputedStyle(document.querySelector(".brand")).fontFamily,
    domMono: getComputedStyle(document.querySelector(".day-cell .dom")).fontFamily.toLowerCase(),
    snap: getComputedStyle(document.getElementById("strip")).scrollSnapType,
    blur: getComputedStyle(document.querySelector(".topbar")).backdropFilter,
    clockPx: getComputedStyle(document.getElementById("clk-hkt")).fontSize,
  }));
  ok("body bg = dark canon #0b0d12", pr.bodyBg === "rgb(11, 13, 18)", pr.bodyBg);
  ok("sans voice on .brand", /-apple-system|system-ui|SF/i.test(pr.brandFont), pr.brandFont.slice(0, 40));
  ok("mono numerals on day cells", /mono/i.test(pr.domMono), pr.domMono.slice(0, 30));
  ok("strip snap-to-day mandatory", /x mandatory/.test(pr.snap), pr.snap);
  ok("topbar is glass material", pr.blur.includes("blur"), String(pr.blur).slice(0, 40));
  ok("HKT clock ~44px", pr.clockPx === "44px", pr.clockPx);

  // live clock ticks + capsule + countdown line
  const ticked = await m.evaluate(() => new Promise(res => {
    const s = document.getElementById("clk-hkt-s"), v0 = s.textContent;
    let k = 0; const iv = setInterval(() => {
      if (s.textContent !== v0) return clearInterval(iv), res(true);
      if (++k > 30) return clearInterval(iv), res(false);
    }, 100);
  }));
  ok("clock ticks every second", ticked);
  const nc = (await m.textContent("#next-change")).replace(/\s+/g, " ").trim();
  ok("next-change has verb+countdown+hkt anchor", /(opens|closes|resumes) in (\d+h \d+m|\d+m|<1m) · \d{2}:\d{2} hkt/.test(nc), nc);
  const mk = await m.textContent("#mkt-label");
  ok("mkt capsule state", /^cme · (open|halt|closed|holiday)/.test(mk.trim()), mk.trim());

  // sessions rail renders three markets with windows in hkt
  const rail = await m.$$eval(".sess", es => es.map(e => ({
    code: e.querySelector(".sess-code").textContent,
    win: e.querySelector(".sess-win").textContent,
    st: e.querySelector(".sess-state").textContent.trim(),
  })));
  ok("rail has tok/lon/nyc", JSON.stringify(rail.map(r => r.code)) === '["tok","lon","nyc"]', rail.map(r => r.code).join(","));
  ok("rail windows are hkt spans or no-session", rail.every(r => /^\d{2}:\d{2}–\d{2}:\d{2} hkt$/.test(r.win) || r.win === "no session"), rail.map(r => r.win).join(" | "));
  ok("rail states are legible verbs", rail.every(r => /^(live|opens in|back in|closed|done|scheduled)/.test(r.st)), rail.map(r => r.st).join(" | "));

  // strip: 43 cells, month ticks match real month starts, today ring, centered
  const stripInfo = await m.evaluate(() => {
    const cells = [...document.querySelectorAll(".day-cell")];
    return { count: cells.length, ticks: cells.filter(c => c.classList.contains("is-month")).length };
  });
  const monthExpect = await m.evaluate(() => {
    const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const isoAdd = (iso, nn) => { const [y, mo, d] = iso.split("-").map(Number); const dt = new Date(Date.UTC(y, mo - 1, d + nn)); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}-${String(dt.getUTCDate()).padStart(2,"0")}`; };
    const todayIso = (() => { const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); return p; })();
    let prev = null, cnt = 0;
    for (let off = -14; off <= 28; off++) {
      const d = new Date(isoAdd(todayIso, off) + "T12:00:00Z");
      if (!prev || d.getUTCMonth() !== prev.getUTCMonth()) cnt++;
      prev = d;
    }
    return cnt;
  });
  ok("43 day cells (-14..+28)", stripInfo.count === 43, String(stripInfo.count));
  ok("month ticks at every month start", stripInfo.ticks === monthExpect, `ticks=${stripInfo.ticks} expected=${monthExpect}`);
  const centered = await m.evaluate(() => {
    const s = document.getElementById("strip");
    const c = s.children[14], r = c.getBoundingClientRect(), sr = s.getBoundingClientRect();
    return Math.abs((r.left + r.right) / 2 - (sr.left + sr.right) / 2);
  });
  ok("today centered in strip", centered < 24, `off=${centered.toFixed(0)}px`);
  const todayRing = await m.$eval('.day-cell.is-today', el => el.getAttribute("aria-current"));
  ok("today ring", todayRing === "date");
  await m.tap('.day-cell[data-off="-3"]');
  ok("tap selects day", /logged/.test(await m.textContent("#focus-line")), (await m.textContent("#focus-line")).trim());
  await m.tap('.day-cell[data-off="0"]');

  // long-press popover still works
  const box = await m.$eval('.day-cell[data-off="-4"]', el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await m.mouse.move(box.x, box.y); await m.mouse.down();
  await m.waitForTimeout(700); await m.mouse.up();
  ok("long-press stats popover", !!(await m.$(".pop")), await m.$eval(".pop p.label", e => e.textContent).catch(() => ""));
  await m.mouse.click(10, 500);
  ok("popover dismissed", !(await m.$(".pop")));

  // events tape: news.json fetched, hero countdown present
  const newsStatus = await m.evaluate(async () => (await fetch("/st/data/news.json?v=r2")).status);
  ok("news.json served", newsStatus === 200, String(newsStatus));
  const heroTtl = (await m.textContent("#ev-next-ttl")).trim();
  ok("hero next-event rendered", heroTtl.length > 3 && !/loading/i.test(heroTtl), heroTtl.slice(0, 60));
  const heroCd = await m.textContent("#ev-next-cd");
  ok("hero countdown ticking text", /^(in (\d+h )?\d+m( \d+s)?|now)$/.test(heroCd.trim()), heroCd.trim());

  // band pins for an event-rich day (wed aug 26 had 17 events) via virtual time
  await m.goto(`${BASE}?at=2026-08-26T21:00`, { waitUntil: "networkidle" });
  const frozen = await m.evaluate(() => ({
    clk: document.getElementById("clk-hkt").textContent,
    sim: !document.getElementById("sim-chip").hidden,
    simTxt: document.getElementById("sim-chip").textContent.trim(),
    pins: document.querySelectorAll(".pin").length,
    cap: document.getElementById("band-cap").hidden,
  }));
  ok("virtual time freezes clock", frozen.clk === "21:00", frozen.clk);
  ok("sim chip announces mock-only review time", frozen.sim && frozen.simTxt === "mock time", frozen.simTxt);
  ok("band shows event pins on event day", frozen.pins >= 4, `${frozen.pins} pins`);
  ok("no band caption on trading day", frozen.cap);

  // pin popover
  await m.tap(".pin >> nth=0");
  ok("pin tap opens event pop", !!(await m.$(".pop")), await m.$eval(".pop .label", e => e.textContent).catch(() => ""));
  await m.mouse.click(10, 600);
  ok("event pop dismissed", !(await m.$(".pop")));

  // events tabs: hero carries its folder colour; wk rows expand on tap
  const heroCls = await m.$eval("#ev-next", el => el.className);
  ok("hero next-event colour-coded", /is-(red|orange)/.test(heroCls), heroCls);
  ok("hero fold glyph rendered", !!(await m.$eval("#ev-next-fold", el => el.innerHTML.trim())), "");
  await m.tap('#ev-tabs [data-ev="wk"]');
  await m.waitForTimeout(120);
  const wkRows = await m.$$(".wk-row");
  ok("wk view: 7 rows", wkRows.length === 7, String(wkRows.length));
  const scope = (await m.textContent("#ev-scope")).trim();
  ok("tape head has scope line", /usd · week of|usd · (mon|tue|wed|thu|fri|sat|sun)/.test(scope), scope);
  const openBefore = await m.$$eval(".wk-detail:not([hidden])", els => els.length);
  const targetDay = await m.evaluate(() => {
    const items = [...document.querySelectorAll(".wk-item")];
    const withEvents = items.filter(it => it.querySelector(".wk-detail .ev-row"));
    const closed = (withEvents.length ? withEvents : items)
      .find(it => it.querySelector(".wk-row").getAttribute("aria-expanded") === "false");
    return closed?.querySelector(".wk-row").dataset.day ?? null;
  });
  ok("a collapsed event-day exists to expand", !!targetDay, String(targetDay));
  await m.tap('.wk-row[data-day="' + targetDay + '"]');
  await m.waitForTimeout(150);
  const openAfter = await m.evaluate(() => document.querySelectorAll(".wk-detail:not([hidden])").length);
  const detRows = await m.evaluate((day) => {
    const item = [...document.querySelectorAll(".wk-row")].find(r => r.dataset.day === day)?.nextElementSibling;
    return item && !item.hidden ? item.querySelectorAll(".ev-row").length : -1;
  }, targetDay);
  ok("wk row expands inline detail", openAfter > openBefore && detRows >= 0, `open=${openAfter} rows=${detRows}`);
  await m.tap('.wk-row[data-day="' + targetDay + '"]');
  await m.waitForTimeout(120);
  const collapsed = await m.evaluate((day) => {
    const r = [...document.querySelectorAll(".wk-row")].find(x => x.dataset.day === day);
    return r && !r.classList.contains("is-open") && r.nextElementSibling.hidden;
  }, targetDay);
  ok("wk row collapses on second tap", collapsed);

  // ---------- scenario matrix (virtual-time mockups) ----------
  const SCEN = [
    ["at=2026-08-25T09:20", "tok live", "#st-tok"],
    ["at=2026-08-25T11:50", "tok lunch", "#st-tok"],
    ["at=2026-08-25T16:00", "lon live", "#st-lon"],
    ["at=2026-08-25T22:35", "ny live", "#st-nyc"],
  ];
  for (const [q, , sel] of SCEN) {
    await m.goto(`${BASE}?${q}`, { waitUntil: "networkidle" });
    await m.waitForTimeout(250);
    const st = (await m.textContent(sel)).trim();
    ok(`scenario ${q.split("=")[1]} → live state`, /live · (\d+h \d+m|\d+m) left/.test(st), st.replace(/\s+/g, " "));
  }
  await m.goto(`${BASE}?at=2026-08-26T05:20`, { waitUntil: "networkidle" });
  await m.waitForTimeout(250);
  ok("scenario halt → capsule halt", (await m.textContent("#mkt-label")).trim() === "cme · halt", (await m.textContent("#mkt-label")).trim());
  ok("scenario halt → resumes countdown", /resumes in/.test(await m.textContent("#next-change")), (await m.textContent("#next-change")).replace(/\s+/g, " "));
  await m.goto(`${BASE}?at=2026-08-29T14:00`, { waitUntil: "networkidle" });
  await m.waitForTimeout(250);
  ok("scenario weekend → closed", /cme · closed/.test((await m.textContent("#mkt-label")).trim()), (await m.textContent("#mkt-label")).trim());
  await m.goto(`${BASE}?at=2026-11-28T02:30`, { waitUntil: "networkidle" });
  await m.waitForTimeout(250);
  ok("scenario half-day → closing countdown", /closes in/.test(await m.textContent("#next-change")) && (await m.textContent("#prog-cap")).includes("%"), (await m.textContent("#next-change")).replace(/\s+/g, " "));

  ok("no console/page errors (mobile)", errors.length === 0, errors.join(" | ").slice(0, 200));
  await m.close();

  // ---------- desktop pass: shell column, palette, theme ----------
  const d = await b.newPage({ viewport: { width: 1512, height: 900 } });
  const derr = [];
  d.on("pageerror", e => derr.push(e.message));
  await d.goto(BASE, { waitUntil: "networkidle" });
  const shell = await d.evaluate(() => {
    const app = document.querySelector(".content").getBoundingClientRect();
    const tb = document.querySelector(".shell-fit.topbar-inner").getBoundingClientRect();
    return { w: Math.round(app.width), cx: Math.round(app.left + app.width / 2), tbw: Math.round(tb.width), vw: innerWidth };
  });
  ok("content column ≤768px on wide monitor", shell.w <= 769, `${shell.w}px @${shell.vw}`);
  ok("column centered", Math.abs(shell.cx - shell.vw / 2) <= 4, `cx=${shell.cx} vs ${Math.round(shell.vw / 2)}`);
  ok("topbar content rides same column", shell.tbw <= 769, `${shell.tbw}px`);

  await d.keyboard.press("Meta+k");
  await d.waitForTimeout(150);
  ok("cmd-k opens (desktop)", await d.$eval("#palette", p => p.open));
  await d.keyboard.press("ArrowDown"); await d.keyboard.press("ArrowUp");
  const act = await d.$eval(".pal-item[data-active='true'] .grow", e => e.textContent).catch(() => "");
  ok("arrow-key nav lands on item", act.trim().length > 0, act.trim());
  await d.keyboard.press("Escape");
  await d.waitForTimeout(120);
  await d.keyboard.press("/");
  await d.waitForTimeout(150);
  await d.type("#pal-input", "tho");
  const first = await d.textContent(".pal-item[data-active='true'] .grow").catch(() => "");
  ok("fuzzy filter ranks thought", first.trim() === "thought", first.trim());
  await d.keyboard.press("Enter");
  await d.waitForTimeout(300);
  ok("enter picks + closes", await d.$eval("#palette", p => !p.open));

  const before = await d.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await d.click('.devrail summary');
  await d.click('#theme-seg [data-t="dark"]');
  await d.waitForTimeout(250);
  const after = await d.evaluate(() => ({
    bg: getComputedStyle(document.body).backgroundColor,
    pressed: document.querySelector('#theme-seg [data-t="dark"]').getAttribute("aria-pressed"),
    meta: document.querySelector('meta[name="theme-color"]').content,
  }));
  ok("theme seg flips bg", before !== after.bg, `${before}→${after.bg}`);
  ok("aria-pressed follows", after.pressed === "true");
  ok("theme seg flips bg to dark", after.bg === "rgb(11, 13, 18)", after.bg);
  ok("theme-color meta syncs", after.meta === "#0b0d12", after.meta);
  await d.click('#theme-seg [data-t="auto"]');

  // SE-width sanity: no horizontal overflow at 320px
  await d.setViewportSize({ width: 320, height: 568 });
  await d.waitForTimeout(250);
  const overflowX = await d.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("no horizontal overflow @320", overflowX <= 0, `overflow=${overflowX}px`);
  ok("no page errors (desktop)", derr.length === 0, derr.join("|").slice(0, 120));
  await d.close();

  await b.close();
  console.log(fails.length ? `\n${fails.length}/${n} FAILURES` : `\nALL ${n} GATES GREEN`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error("FATAL", e.message); process.exit(2); });
