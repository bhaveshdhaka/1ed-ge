/* ============================================================
   1edge today-rail gate — S03 · session C10
   Runs against the LIVE deployed URL — never local bytes.
     sh docs/design/gate.sh design/mocks/_verify/today.gate.cjs
     ZEN_BASE overrides target (default https://mock.1ed.ge)
   Covers: shell/assets, facts strip + bottom-sheet editors,
   trades accordion + lazy tickets + expand-all, day events
   digest (grammar + pins), stream + lightbox, reflection
   obligation states (?state= matrix + ai draft), navchips +
   palette + g-chords, 44pt targets, mobile one-handed layout.
   ============================================================ */
const { chromium } = require("playwright-core");

const BASE = process.env.ZEN_BASE || "https://mock.1ed.ge";
const URL_ = BASE.replace(/\/$/, "") + "/zen/today.html";
let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${extra ? " — " + extra : ""}`); }
}
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

(async () => {
  console.log(`today gate → ${URL_}\n`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  /* ---------- shell ---------- */
  console.log("shell");
  const resp = await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 15000 });
  ok("200 on page", resp.status() === 200, String(resp.status()));
  ok("title reads today", (await page.title()).includes("today"));
  const rawHtml = await (await page.request.get(URL_)).text();
  ok("sprint id comment present", rawHtml.includes("S03-today"));
  ok("feedback annotator mounted", await page.$eval("#fb-toggle", () => true).catch(() => false));
  for (const asset of ["tokens", "base", "frame", "composer", "rail"]) {
    const r = await page.request.get(`${BASE}/st/css/${asset}?v=c10`);
    ok(`css ${asset} serves 200`, r.status() === 200);
  }
  const railCss = await (await page.request.get(`${BASE}/st/css/rail?v=c10`)).text();
  const cssBody = railCss.replace(/\/\*[\s\S]*?\*\//g, "");
  ok("rail.css zero color literals", !/#[0-9a-fA-F]{3,8}\b/.test(cssBody) && !/rgba?\(/i.test(cssBody));

  /* ---------- facts strip ---------- */
  console.log("facts");
  await page.waitForSelector(".factrow");
  ok("five fact rows render", (await page.$$(".facts .factrow")).length === 5);
  ok("mood seeded", (await page.textContent("#fv-mood")).includes("sharp"));
  const tradesTxt = await page.textContent("#fv-trades");
  ok("trades line computes day r", tradesTxt.includes("5") && /\+\d+\.\d+r/.test(tradesTxt), tradesTxt.trim());
  ok("open trade disclosed in facts", tradesTxt.includes("1 open"));

  await page.click('.factrow[data-sheet="mood"]');
  ok("sheet opens on tap", await page.$eval("#sh", (d) => d.open));
  ok("sheet holds a real form", await page.$eval("#sh-form", () => true).catch(() => false));
  ok("mood input is named", !!(await page.$('#sh input[name="mood"]')));
  await page.click('#sh-body [data-v="clear"]');
  ok("chip syncs into hidden input",
    (await page.inputValue('#sh input[name="mood"]')) === "clear");
  await page.click('#sh-form button[type="submit"]');
  await sleep(150);
  ok("save closes sheet", !(await page.$eval("#sh", (d) => d.open)));
  ok("row updated inline", (await page.textContent("#fv-mood")).includes("clear"));

  await page.click('.factrow[data-sheet="sleep"]');
  ok("sleep fields named", !!(await page.$('#sh input[name="sleep_hours"]')) &&
    !!(await page.$('#sh input[name="sleep_quality"]')));
  await page.fill('#sh input[name="sleep_hours"]', "8");
  await page.click('#sh-form button[type="submit"]');
  await sleep(120);
  ok("sleep row updated", (await page.textContent("#fv-sleep")).includes("8h"));

  await page.click('.factrow[data-sheet="devices"]');
  ok("three device inputs", (await page.$$('#sh input[name^="dev_"]')).length === 3);
  await page.click("#sh-cancel");
  await sleep(100);
  ok("cancel closes without change", !(await page.$eval("#sh", (d) => d.open)));

  await page.click('.factrow[data-sheet="habits"]');
  ok("done habit pre-ticked",
    await page.$eval('#sh-body [data-v="workout"]', (b) => b.getAttribute("aria-pressed") === "true"));
  ok("undone habit unticked",
    await page.$eval('#sh-body [data-v="sunlight"]', (b) => b.getAttribute("aria-pressed") === "false"));
  await page.click('#sh-body [data-v="sunlight"]');
  await page.click('#sh-form button[type="submit"]');
  await sleep(120);
  ok("habit tick lands inline",
    (await page.$$eval("#fv-habits .t-yes", (ns) => ns.length)) === 3);

  /* ---------- trades ---------- */
  console.log("trades");
  await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector(".trow");
  ok("five collapsed rows", (await page.$$(".trow")).length === 5);
  ok("won trade colors green", (await page.$$(".r-chip.is-pos")).length >= 2);
  ok("lost trade colors red", (await page.$$(".r-chip.is-neg")).length >= 1);
  ok("open trade stays flat", (await page.$$(".r-chip.is-flat")).length === 1);
  ok("tickets lazy — none injected at rest", (await page.$$(".tdisc-in .ticket")).length === 0);

  const firstWrap = page.locator(".trow-wrap").first();
  await firstWrap.locator(".trow").click();
  await sleep(320);
  ok("row expands", await firstWrap.evaluate((w) => w.classList.contains("is-open")) &&
    (await firstWrap.locator(".trow").getAttribute("aria-expanded")) === "true");
  ok("ticket injects fills", (await firstWrap.locator(".fill-row").count()) === 2);
  ok("ticket carries note", (await firstWrap.locator(".card-text").textContent()).includes("retest"));
  ok("screenshots lazy-render",
    await firstWrap.locator('.tk-shot img[loading="lazy"]').first().evaluate(() => true).catch(() => false));

  await page.click("#tx-all");
  await sleep(420);
  ok("expand-all opens every row",
    (await page.$$(".trow-wrap.is-open")).length === 5);
  ok("all tickets injected", (await page.$$(".tdisc-in .ticket")).length === 5);
  ok("button flips to collapse all", (await page.textContent("#tx-all")).includes("collapse"));
  await page.click("#tx-all");
  await sleep(320);
  ok("collapse-all shuts every row", (await page.$$(".trow-wrap.is-open")).length === 0);

  /* ---------- stream + lightbox ---------- */
  console.log("stream");
  ok("stream count", (await page.textContent("#st-count")).includes("4 today"));
  ok("four cards", (await page.$$("#st-box .card")).length === 4);
  ok("quote keeps citation voice", !!(await page.$("#st-box blockquote.q-card cite")));
  await page.click("#st-box .card-img");
  ok("lightbox opens", await page.$eval("#lb", (d) => d.open));
  ok("lightbox holds image", (await page.getAttribute("#lb-img", "src")).startsWith("data:image"));
  await page.keyboard.press("Escape");
  await sleep(120);
  ok("escape closes lightbox", !(await page.$eval("#lb", (d) => d.open)));

  /* ---------- reflection ---------- */
  console.log("reflection");
  const chipCls = await page.getAttribute("#refl-chip", "class");
  ok("live chip derives due", /\bdue\b/.test(chipCls), chipCls);
  ok("due chip uses duration grammar", GRAMMAR.test(cleanCd(await page.textContent("#refl-chip"))),
    await page.textContent("#refl-chip"));
  ok("meta states the deadline", (await page.textContent(".refl-meta")).includes("03:00 hkt"));
  ok("draft affordance present", await vis(page, "#draft-btn"));

  /* draft loop lives on the LIVE page — forced states pin the chip */
  await page.click("#draft-btn");
  ok("draft spins while thinking", await page.$eval("#draft-btn svg", (s) => s.classList.contains("spin")));
  await page.waitForFunction(() =>
    document.querySelector(".refl-text")?.textContent.includes("three lines, honestly"),
    { timeout: 3000 }).then(() => true).catch(() => false);
  ok("ai draft lands", !!(await page.$("#refl-body .capsule")));
  ok("mark done offered after draft", await vis(page, "#done-btn"));
  await page.click("#done-btn");
  await sleep(120);
  ok("mark done completes loop", (await page.textContent("#refl-chip")) === "done");

  await page.goto(URL_ + "?state=done", { waitUntil: "domcontentloaded", timeout: 15000 });
  ok("?state=done flips chip", ((await page.getAttribute("#refl-chip", "class")) || "").includes("done") &&
    (await page.textContent("#refl-chip")) === "done");
  ok("done shows saved text", (await page.textContent(".refl-text")).includes("screen time is the leak"));
  ok("draft hides when done", !(await vis(page, "#draft-btn")));

  await page.goto(URL_ + "?state=overdue", { waitUntil: "domcontentloaded", timeout: 15000 });
  ok("?state=overdue flips chip", ((await page.getAttribute("#refl-chip", "class")) || "").includes("overdue"));
  const ovTxt = await page.textContent("#refl-chip");
  ok("overdue chip grammar", ovTxt.startsWith("overdue · ") && GRAMMAR.test(cleanCd(ovTxt)), ovTxt);

  /* ---------- navigation ---------- */
  console.log("navigation");
  await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector(".navchip");
  ok("five navchips", (await page.$$(".navchip")).length === 5);
  await page.click('[data-jump="sec-trades"].navchip');
  await sleep(500);
  ok("navchip scrolls to section",
    (await page.evaluate(() => location.hash)) === "#sec-trades" &&
    (await page.evaluate(() => window.scrollY)) > 100);

  await page.keyboard.press("ControlOrMeta+k");
  ok("cmd-k opens palette", await page.$eval("#palette", (d) => d.open));
  await page.fill("#pal-input", "refl");
  await sleep(80);
  ok("palette filters", (await page.$$("#pal-list .pal-item")).length >= 1);
  await page.keyboard.press("Enter");
  await sleep(400);
  ok("palette enter jumps", (await page.evaluate(() => location.hash)) === "#sec-reflect");

  await page.evaluate(() => scrollTo(0, 0));
  await page.keyboard.press("g");
  await page.keyboard.press("t");
  await sleep(450);
  ok("g-chord g+t jumps", (await page.evaluate(() => location.hash)) === "#sec-trades");

  /* ---------- frozen time: events digest ---------- */
  console.log("events (frozen)");
  await page.goto(URL_ + "?at=2026-08-25T21:00", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForFunction(() => {
    const el = document.getElementById("ev-count");
    return el && el.textContent !== "—";
  }, { timeout: 6000 }).catch(() => {});
  const cnt = await page.textContent("#ev-count");
  ok("day scope counted", /^\d+ usd$/.test(cnt.trim()), cnt.trim());
  const rowsN = await page.$$eval("#ev-box .ev-row", (rs) => rs.length);
  ok("digest lists the day", rowsN > 0, String(rowsN));
  const pastN = await page.$$eval("#ev-box .ev-row.is-past", (rs) => rs.length);
  ok("past rows dimmed", pastN === 5, String(pastN));
  ok("upcoming carry countdowns", (await page.$$eval("#ev-box [data-cd]", (rs) => rs.length)) === 4);
  const nextRow = await page.$eval("#ev-box .ev-row.is-next .ttl", (el) => el.textContent)
    .catch(() => "");
  ok("next row flagged", nextRow.includes("New Home Sales"), nextRow);
  const cdText = await page.$eval("#ev-box [data-cd]", (el) => el.textContent);
  ok("news countdown grammar", GRAMMAR.test(cleanCd(cdText)), cdText);
  ok("no bare-colon countdowns anywhere", !(cdText.includes(":")));
  const pinN = await page.$$eval("#band .pin", (ps) => ps.length);
  ok("band pins mirror the digest", pinN === rowsN, `${pinN} vs ${rowsN}`);
  ok("sim chrome announces mock time", await vis(page, "#sim-chip"));

  /* ---------- 44pt targets ---------- */
  console.log("targets");
  for (const [name, sel] of [
    ["fact row", ".factrow"],
    ["navchip", ".navchip"],
    ["trade row", ".trow"],
    ["expand-all", "#tx-all"],
    ["draft btn", "#draft-btn"],
  ]) {
    const t = await targetAtLeast(page, sel);
    ok(`${name} ≥44pt target`, t.h >= 43.5 && t.w >= 43.5, `${Math.round(t.w)}×${Math.round(t.h)}`);
  }

  /* ---------- mobile: one-handed + bottom sheet ---------- */
  console.log("mobile");
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true,
  });
  const mp = await mctx.newPage();
  const merr = [];
  mp.on("pageerror", (e) => merr.push(String(e)));
  await mp.goto(URL_, { waitUntil: "domcontentloaded", timeout: 15000 });
  await mp.waitForSelector(".cstub");
  ok("no horizontal overflow", await mp.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth + 1));
  const ys = await mp.evaluate(() => ({
    stub: document.getElementById("cstub").getBoundingClientRect().top,
    facts: document.getElementById("sec-facts").getBoundingClientRect().top,
  }));
  ok("composer stub precedes the rail", ys.stub < ys.facts);
  ok("palette fab visible one-handed", await mp.$eval("#fab-k", (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom <= innerHeight && r.height >= 40;
  }));
  await mp.click('.factrow[data-sheet="mood"]');
  await sleep(260);
  ok("sheet docks bottom on touch", await mp.$eval("#sh", (d) => {
    const s = getComputedStyle(d);
    return d.open && parseFloat(s.borderBottomLeftRadius) === 0 &&
      parseFloat(s.borderTopLeftRadius) > 0 &&
      d.getBoundingClientRect().bottom >= innerHeight - 2;
  }));
  ok("mobile page clean", merr.length === 0, merr.join("; ").slice(0, 120));
  await mctx.close();

  /* ---------- errors ---------- */
  ok("no page errors on load", errors.length === 0, errors.join("; ").slice(0, 160));

  await browser.close();
  console.log(`\ntoday gate: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("gate crashed:", e); process.exit(2); });
