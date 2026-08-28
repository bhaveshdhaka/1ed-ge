/* ============================================================
   S07-public-home gate — /public/. Runs against the LIVE deploy
   (SESSIONS.md gate protocol), lib.cjs harness.
   Acceptance: 5-second test (live status + day-r above the fold
   on 390) · green/red ONLY on data values (chrome dots ride the
   accent ladder — the deliberate zen divergence) · countdown
   grammar incl. T-15m news seconds · news stem-dedupe · native
   <dialog> lightbox · sized lazy media (no layout shift) ·
   44pt targets · graceful ?day=empty fallback · ?at freeze
   honesty (open / halt-free weekend / holiday) · zero framework
   JS · no /zen door · zero color literals in the layer css.
   ============================================================ */
const { makeGate, GRAMMAR, cleanCd, targetAtLeast } = require("./lib.cjs");
const g = makeGate({ path: "/public/", id: "S07-public-home" });
const rgb = (s) => String(s).replace(/\s/g, "");
const UP = "rgb(76,183,130)", DOWN = "rgb(229,72,77)", WARN = "rgb(217,165,82)";
const R_FMT = /^[+−-]\d+(\.\d+)?r$|^—r$/;

(async () => {
  const page = await g.open();
  await page.emulateMedia({ colorScheme: "dark" });   // asserts pin the dark canon (light is the same structure by doctrine)

  /* ---------- shell ---------- */
  const resp = await page.goto(g.url, { waitUntil: "networkidle", timeout: 20000 });
  g.ok("200 on page", resp.status() === 200, String(resp.status()));
  g.ok('title reads "traded in public"', (await page.title()).includes("traded in public"));
  const raw = await (await page.request.get(g.url)).text();
  g.ok("sprint id comment present", raw.includes("S07-public-home"));
  g.ok("feedback annotator mounted", await page.$eval("#fb-toggle", () => true).catch(() => false));
  const cssRes = await page.request.get(`${g.BASE}/st/css/public?v=c14c`);
  g.ok("public.css serves 200", cssRes.status() === 200, String(cssRes.status()));
  const cssBody = (await cssRes.text()).replace(/\/\*[\s\S]*?\*\//g, "");
  g.ok("public.css zero color literals", !/#[0-9a-fA-F]{3,8}\b/.test(cssBody) && !/rgba?\(/i.test(cssBody));
  const srcs = [...raw.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  g.ok("zero framework js (theme+feedback only)", srcs.length === 2
    && srcs.every((s) => /\/st\/js\/(theme|feedback)/.test(s)), JSON.stringify(srcs));
  g.ok("no /zen door in markup", !/href="[^"]*zen/.test(raw));

  /* ---------- masthead: live status, nav, theme, chrome discipline ---------- */
  g.ok("brand visible", await g.vis(page, ".brand"));
  g.ok("thesis visible", await g.vis(page, ".mast-thesis"));
  const navLinks = await page.$$eval(".mast-nav a", (els) => els.map((e) => ({ t: e.textContent.trim(), h: e.href })));
  g.ok("nav rail: 5 destinations", navLinks.length === 5, JSON.stringify(navLinks.map((l) => l.t)));
  g.ok("nav rail: no zen door", navLinks.every((l) => !/zen/.test(l.h)));
  const segBtns = await page.$$("#theme-seg [data-t]");
  g.ok("theme switcher: 3 modes", segBtns.length === 3, String(segBtns.length));
  g.ok("theme switcher: exactly one pressed", (await page.$$eval("#theme-seg [data-t]", (els) => els.filter((e) => e.getAttribute("aria-pressed") === "true").length)) === 1);
  g.ok("market strip visible", await g.vis(page, ".mkt-strip"));
  const msState = (await page.textContent("#ms-state")).trim();
  g.ok("strip state is cme canon", /^cme · (open|halt|closed)/.test(msState), msState);
  const mktCd = (msState.match(/\(([^)]+)\)/) || [])[1] || "";
  g.ok("strip countdown grammar", GRAMMAR.test(mktCd), mktCd);
  g.ok("strip clock is hh:mm", /^\d{2}:\d{2}$/.test((await page.textContent("#ms-clock")).trim()));
  g.ok("strip next-event line present", (await page.textContent("#ms-next")).trim().length > 0);
  const pulseCol = rgb(await page.$eval(".pulse", (el) => getComputedStyle(el).backgroundColor));
  g.ok("pulse never green/red (chrome ladder)", pulseCol !== UP && pulseCol !== DOWN, pulseCol);
  const dotCol = rgb(await page.$eval(".mkt-strip .dot", (el) => getComputedStyle(el).backgroundColor));
  g.ok("market dot never green/red", dotCol !== UP && dotCol !== DOWN, dotCol);
  await page.click('#theme-seg [data-t="light"]');
  g.ok("theme: light force-enables overlay", await page.$eval("#ls-force", (el) => !el.disabled)
    && (await page.$eval("html", (el) => el.getAttribute("data-theme"))) === "light");
  await page.click('#theme-seg [data-t="dark"]');
  g.ok("theme: dark pins canon", await page.$eval("#ls-force", (el) => el.disabled)
    && (await page.$eval("html", (el) => el.getAttribute("data-theme"))) === "dark");
  await page.click('#theme-seg [data-t="auto"]');
  g.ok("theme: auto restores system-follow", (await page.$eval("html", (el) => el.getAttribute("data-theme"))) === "auto");

  /* ---------- today card: the 5-second contract ---------- */
  const dayr = (await page.textContent("#dayr")).trim();
  g.ok("day-r readout format", /^[+−-]\d+(\.\d+)?r$/.test(dayr), dayr);
  const dayrCls = await page.$eval("#dayr", (el) => el.classList.contains("num-up") || el.classList.contains("num-down"));
  g.ok("day-r colored as data", dayrCls);
  g.ok("r legend visible", await g.vis(page, ".dayr-legend"));
  g.ok("hero $ readout", /^\$\d[\d,]*$/.test((await page.textContent("#day-pnl")).trim()));
  const cells = await page.$$eval(".fact-v", (els) => els.map((e) => ({ t: e.textContent.trim(), clip: e.scrollWidth > e.clientWidth })));
  g.ok("5 fact cells", cells.length === 5, String(cells.length));
  g.ok("no fact cell truncates to a lie", cells.every((c) => !c.clip), JSON.stringify(cells.filter((c) => c.clip)));

  /* ---------- news: impact dots are data, dedupe, grammar ------ */
  const nRows = await page.$$(".news-row");
  g.ok("news rows ≤5", nRows.length >= 1 && nRows.length <= 5, String(nRows.length));
  const dotCols = (await page.$$eval(".news-row .n-dot", (els) => els.map((e) => getComputedStyle(e).backgroundColor))).map(rgb);
  g.ok("impact dots only warn/red (never green/accent)", dotCols.length > 0 && dotCols.every((c) => c === WARN || c === DOWN), JSON.stringify([...new Set(dotCols)]));
  const stems = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).map((w) => w.slice(0, 5));
  const dupes = await page.$$eval(".news-row .n-title", (els) => els.map((e) => e.textContent.trim()));
  const stemLists = dupes.map(stems);
  g.ok("no cross-wire duplicate stories", stemLists.every((s, i) =>
    stemLists.every((o, j) => i === j || s.filter((x) => o.includes(x)).length < 2)));
  const cds = await page.$$eval(".news-row .n-cd", (els) => els.map((e) => e.textContent.trim()));
  g.ok("news countdown grammar (secs allowed)", cds.every((c) => /^(?:(\d+)h )?\d+m( \d{2}s)?$/.test(c)), JSON.stringify(cds));
  g.ok("news row times are hkt clock form", (await page.$$eval(".news-row .n-time", (els) => els.map((e) => e.textContent.trim()))).every((t) => /^\d{2}:\d{2}$/.test(t)));

  /* ---------- performance strip: server-svg, token-hued -------- */
  g.ok("equity spark renders", await page.$eval(".spark path", () => true).catch(() => false));
  const sparkStroke = rgb(await page.$eval(".spark path", (el) => getComputedStyle(el).stroke));
  g.ok("spark line rides data hue", sparkStroke === UP, sparkStroke);
  g.ok("r histogram bars", (await page.$$(".hist rect")).length >= 40);
  const histFills = (await page.$$eval(".hist rect", (els) => [...new Set(els.map((e) => getComputedStyle(e).fill))])).map(rgb);
  g.ok("hist bars only up/down/faint", histFills.every((c) => c === UP || c === DOWN || c === "rgba(239,242,247,0.26)"), JSON.stringify(histFills));
  g.ok("perf caps present", (await page.$$(".perf-cap")).length === 2);

  /* ---------- stream: cards, rails, data colors, lightbox ------ */
  const cards = await page.$$(".stream > li");
  g.ok("stream cards render", cards.length >= 4, String(cards.length));
  const tradeLis = await page.$$(".stream > li.is-trade");
  const tradeCards = await page.$$(".stream .t-facts");
  g.ok("trade nodes ringed on trade cards", tradeLis.length === tradeCards.length, `${tradeLis.length}/${tradeCards.length}`);
  const rChips = (await page.$$eval(".r-chip", (els) => els.map((e) => ({ t: e.textContent.trim(), c: getComputedStyle(e).color })))).map((x) => ({ t: x.t, c: rgb(x.c) }));
  g.ok("r-chips honest format", rChips.length >= 3 && rChips.every((r) => R_FMT.test(r.t)), JSON.stringify(rChips.map((r) => r.t)));
  g.ok("r-chip colors are data-only", rChips.every((r) => r.t === "—r" ? r.c !== UP && r.c !== DOWN : (r.t.startsWith("+") ? r.c === UP : r.c === DOWN)));
  const dirs = (await page.$$eval(".dir-chip", (els) => els.map((e) => ({ d: e.classList.contains("long") ? "long" : "short", c: getComputedStyle(e).color })))).map((x) => ({ d: x.d, c: rgb(x.c) }));
  g.ok("dir chips colored by direction", dirs.every((x) => x.c === (x.d === "long" ? UP : DOWN)));
  const sized = await page.$$eval(".stream img", (els) => els.every((i) => i.getAttribute("width") && i.getAttribute("height") && i.getAttribute("loading") === "lazy"));
  g.ok("all stream media sized + lazy (no layout shift)", sized);
  await page.click(".shot >> nth=0");
  g.ok("lightbox opens (native dialog)", await page.$eval("#lb", (el) => el.open));
  await page.keyboard.press("Escape");
  g.ok("escape closes lightbox", await page.$eval("#lb", (el) => !el.open));

  /* ---------- targets (desktop pass) ---------- */
  for (const [name, sel] of [["perf link", ".perf-go"], ["footer link", ".foot-links a"], ["shot thumb", ".shot"], ["nav link", ".mast-nav a"]]) {
    const t = await targetAtLeast(page, sel);
    g.ok(`44pt target: ${name}`, t.w >= 44 && t.h >= 44, `${Math.round(t.w)}x${Math.round(t.h)}`);
  }

  /* ---------- 390 fold: the 5-second test on iPhone ----------- */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  g.ok("[390] masthead one-line state holds (thesis visible)", await g.vis(page, ".mast-thesis"));
  g.ok("[390] facts fold to 3-col unclipped", await page.$$eval(".fact-v", (els) => els.length === 5 && els.every((e) => e.scrollWidth <= e.clientWidth)));
  g.ok("[390] perf stats visible on own row", await g.vis(page, ".perf-stats"));
  g.ok("[390] strip clock whole (no clip)", await page.$eval("#ms-clock", (el) => {
    const r = el.getBoundingClientRect();
    return r.right <= innerWidth && r.width > 20;
  }));
  g.ok("[390] strip state readable", await page.$eval("#ms-state", (el) => el.scrollWidth <= el.clientWidth + 1));
  g.ok("[390] fallback hidden by default", !(await page.$eval("#fallback", (el) => !el.hidden)));
  const dayrBox = await page.$eval("#dayr", (el) => el.getBoundingClientRect().top + el.getBoundingClientRect().height);
  g.ok("[390] day-r above the 844 fold", dayrBox <= 844, String(Math.round(dayrBox)));
  for (const [name, sel] of [["perf link", ".perf-go"], ["footer link", ".foot-links a"]]) {
    const t = await targetAtLeast(page, sel);
    g.ok(`[390] 44pt target: ${name}`, t.w >= 44 && t.h >= 44, `${Math.round(t.w)}x${Math.round(t.h)}`);
  }

  /* ---------- state: graceful empty-today fallback ------------- */
  await page.goto(g.BASE + "/public/?day=empty", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  g.ok("[empty] fallback banner shows", await page.$eval("#fallback", (el) => !el.hidden));
  const fb = (await page.textContent("#fallback")).trim();
  g.ok("[empty] fallback one line, ends with a period", /^[^.]+\.$/.test(fb) && !fb.includes("\n"), fb);
  g.ok("[empty] date flips to logged day", (await page.textContent("#today-date")).includes("27-aug-2026"));
  g.ok("[empty] stream count names the day", /27.aug.2026/.test(await page.textContent("#stream-count")));
  g.ok("[empty] day-r swaps to fallback day", (await page.textContent("#dayr")).trim() === "+1.12r");

  /* ---------- state: T-15m news seconds grammar ---------------- */
  await page.goto(g.BASE + "/public/?at=2026-08-28T21:52", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const secCds = await page.$$eval(".news-row", (els) => els.map((e) => ({
    past: e.classList.contains("is-past"),
    cd: e.querySelector(".n-cd")?.textContent.trim() || "",
  })));
  g.ok("[?at 21:52] a 22:00 countdown runs seconds", secCds.some((r) => /^\d{1,2}m \d{2}s$/.test(r.cd)), JSON.stringify(secCds));
  g.ok("[?at 21:52] past rows carry no countdown", secCds.filter((r) => r.past).every((r) => !r.cd));
  g.ok("[?at 21:52] mkt open + live pulse", (await page.textContent("#ms-state")).startsWith("cme · open")
    && await page.$eval("#mast", (el) => el.classList.contains("is-live")));
  g.ok("[?at 21:52] cme-line clock form only (no bare-colon duration)", !/\b\d{1,2}:\d{2}\b/.test((await page.textContent("#cme-line")).replace(/closes \d{2}:\d{2} hkt/, "")));

  /* ---------- state: weekend close honesty --------------------- */
  await page.goto(g.BASE + "/public/?at=2026-08-29T14:30", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  g.ok("[?at sat] mkt reads closed", (await page.textContent("#ms-state")).startsWith("cme · closed"));
  g.ok("[?at sat] cme-line names the weekend", (await page.textContent("#cme-line")).includes("weekend"));
  g.ok("[?at sat] pulse not live", await page.$eval("#mast", (el) => !el.classList.contains("is-live")));
  g.ok("[?at sat] past events show no countdowns", await page.$$eval(".news-row .n-cd", (els) => els.length === 0));

  /* ---------- state: early close (post-thanksgiving 2026-11-27)
     CANON NOTES (frozen-engine parity, probe-caught):
     · holidays produce no bounds → a holiday MONDAY reads
       "cme · closed · weekend"; the "cme · holiday" label branch
       is dead in the frozen zen frame too (S09 candidate).
     · the frozen holiday table has NO labor day (real CME
       early-closes it) — flagged for DECISIONS at freeze, not an
       S07 divergence. this block exercises the early-close path
       the canon DOES define: 13:15 ct close = 03:15 hkt sat. */
  await page.goto(g.BASE + "/public/?at=2026-11-28T10:00", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  g.ok("[?at early-close] mkt reads closed", (await page.textContent("#ms-state")).startsWith("cme · closed"));
  g.ok("[?at early-close] cme-line names the early close", (await page.textContent("#cme-line")).includes("early close"));
  g.ok("[?at early-close] pulse not live", await page.$eval("#mast", (el) => !el.classList.contains("is-live")));
  const holDot = rgb(await page.$eval(".mkt-strip .dot", (el) => getComputedStyle(el).backgroundColor));
  g.ok("[?at early-close] dot never green/red", holDot !== UP && holDot !== DOWN, holDot);
  await page.goto(g.BASE + "/public/?at=2026-11-27T20:00", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  g.ok("[?at short-day] session closing at 03:15 hkt is honest", (await page.textContent("#cme-line")).includes("closes 03:15 hkt"),
    await page.textContent("#cme-line"));

  await g.done();
})().catch((e) => { console.error("gate crashed:", e); process.exit(1); });
