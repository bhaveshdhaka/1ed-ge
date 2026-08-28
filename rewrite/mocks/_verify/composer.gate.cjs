/* ============================================================
   1edge composer gate — S02 · session C09 · REWRITTEN FROM ZERO
   (prior gate voided with the C07/C08 output it tested).
   Runs against the LIVE deployed URL — never local bytes.
     NODE_PATH=/tmp/opencode/gate/node_modules node composer.gate.cjs
     ZEN_BASE overrides target (default https://mock.1ed.ge)
   ============================================================ */
const { chromium } = require("playwright-core");

const BASE = process.env.ZEN_BASE || "https://mock.1ed.ge";
const URL_ = BASE.replace(/\/$/, "") + "/zen/composer.html";
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

(async () => {
  console.log(`composer gate → ${URL_}\n`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  /* ---------- shell ---------- */
  console.log("shell");
  const resp = await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 15000 });
  ok("200 on page", resp.status() === 200, String(resp.status()));
  ok("title reads compose", (await page.title()).includes("compose"));
  const rawHtml = await (await page.request.get(URL_)).text();
  ok("sprint id comment present", rawHtml.includes("S02-composer"));
  ok("feedback annotator mounted", await page.$eval("#fb-toggle", () => true).catch(() => false));
  for (const asset of ["tokens", "base", "frame", "composer"]) {
    const r = await page.request.get(`${BASE}/st/css/${asset}?v=c9`);
    ok(`css ${asset} serves 200`, r.status() === 200);
  }
  const css = await (await page.request.get(`${BASE}/st/css/composer?v=c9`)).text();
  const cssBody = css.replace(/\/\*[\s\S]*?\*\//g, "");
  ok("composer.css zero color literals", !/#[0-9a-fA-F]{3,8}\b/.test(cssBody) && !/rgba?\(/i.test(cssBody));
  ok("no page errors on load", errors.length === 0, errors.join("; ").slice(0, 120));

  /* ---------- modes ---------- */
  console.log("modes");
  ok("thought default pressed",
    await page.$eval('#mode-seg [data-m="thought"]', (b) => b.getAttribute("aria-pressed") === "true"));
  ok("quote block hidden by default", !(await vis(page, '.comp-mode[data-mode="quote"]')));
  await page.click('#mode-seg [data-m="quote"]');
  ok("quote opens author field", await vis(page, "#f-author"));
  ok("quote textarea italic", await page.$eval("#f-quote", (el) => getComputedStyle(el).fontStyle === "italic"));
  await page.click('#mode-seg [data-m="trade"]');
  ok("trade row1 visible", await vis(page, "#f-entry") && await vis(page, "#f-stop"));
  ok("R guard dash on empty", (await page.textContent("#r-val")).trim() === "—" &&
    (await page.textContent("#r-sub")).includes("no risk yet"));
  ok("row2 hidden until disclosed", !(await vis(page, "#trade-more")) &&
    (await page.getAttribute("#more-btn", "aria-expanded")) === "false");
  await page.goto(URL_ + "?mode=trade", { waitUntil: "domcontentloaded", timeout: 15000 });
  ok("?mode=trade boots trade",
    await page.$eval('#mode-seg [data-m="trade"]', (b) => b.getAttribute("aria-pressed") === "true"));
  await page.goto(URL_ + "?mode=trade&more=1", { waitUntil: "domcontentloaded", timeout: 15000 });
  ok("?more=1 boots row2 open", await vis(page, "#trade-more"));

  /* ---------- writing surface ---------- */
  console.log("writing");
  await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector("#f-thought");
  await page.evaluate(() => document.activeElement?.blur());   /* desktop autofocus boots calm — measure rest first */
  await sleep(180);
  const taFont = await page.$eval("#f-thought", (el) => parseFloat(getComputedStyle(el).fontSize));
  const taMinRest = await page.$eval("#f-thought", (el) => parseInt(getComputedStyle(el).minHeight, 10));
  ok("writing type is large (≥18px)", taFont >= 18, `${taFont}px`);
  ok("writing space is tall at rest (≥140px)", taMinRest >= 140, `${taMinRest}px`);
  await page.focus("#f-thought");
  await sleep(180);
  ok("caret dims the chrome", await page.evaluate(() => document.body.dataset.writing === "1") &&
    await page.$eval("#topbar", (el) => parseFloat(getComputedStyle(el).opacity) < 1));
  const taMinFocus = await page.$eval("#f-thought", (el) => parseInt(getComputedStyle(el).minHeight, 10));
  ok("surface grows on focus", taMinFocus > taMinRest, `${taMinRest} → ${taMinFocus}px`);
  await page.evaluate(() => document.activeElement.blur());
  const returned = await page.waitForFunction(
    () => !document.body.hasAttribute("data-writing") &&
      parseFloat(getComputedStyle(document.getElementById("topbar")).opacity) === 1,
    { timeout: 2500 }).then(() => true).catch(() => false);
  ok("leaving the composer returns the page", returned);
  await page.click('#mode-seg [data-m="trade"]');
  await page.focus("#f-entry");
  await sleep(80);
  ok("trade fields never trigger calm", await page.evaluate(() => !document.body.hasAttribute("data-writing")));

  /* ---------- thought publish + undo ---------- */
  console.log("thought");
  await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.fill("#f-thought", "patience is a position.");
  await page.press("#f-thought", "Enter");
  await sleep(120);
  const cardText = await page.$eval("#stream .card", (c) => c.textContent);
  ok("enter publishes optimistic card", cardText.includes("patience is a position."));
  ok("input cleared after publish", (await page.inputValue("#f-thought")) === "");
  ok("toast names the capture", (await page.textContent("#toast-msg")).includes("thought captured"));
  ok("undo offered", await vis(page, "#toast-undo"));
  ok("stream count ticks", (await page.textContent("#stream-count")).includes("1 today"));
  ok("drain bar animating", await page.$eval("#toast-drain",
    (d) => getComputedStyle(d).animationName === "drain" && parseFloat(getComputedStyle(d).animationDuration) > 4));
  const undoT = await targetAtLeast(page, "#toast-undo");
  ok("target ≥44 #toast-undo (live)", undoT.w >= 43.5 && undoT.h >= 43.5, `${undoT.w.toFixed(1)}x${undoT.h.toFixed(1)}`);
  await page.click("#toast-undo");
  await sleep(100);
  ok("undo removes card", (await page.$$("#stream .card")).length === 0);
  ok("undo restores the draft", (await page.inputValue("#f-thought")) === "patience is a position.");

  /* ---------- quote ---------- */
  console.log("quote");
  await page.click('#mode-seg [data-m="quote"]');
  await page.fill("#f-quote", "the market rewards process, not predictions.");
  await page.fill("#f-author", "the desk");
  await page.press("#f-quote", "Enter");
  await sleep(120);
  const qCard = await page.$eval("#stream .card", (c) => c.textContent);
  ok("quote card cites author", qCard.includes("the desk") && qCard.includes("rewards process"));

  /* ---------- trade R engine ---------- */
  console.log("trade");
  await page.click('#mode-seg [data-m="trade"]');
  await page.fill("#f-entry", "23450");
  await page.fill("#f-stop", "23420");
  await sleep(60);
  ok("risk-only guard state", (await page.textContent("#r-val")).trim() === "—" &&
    (await page.textContent("#r-sub")).includes("risk 30 pt"));
  await page.click("#more-btn");
  ok("more discloses row2", await vis(page, "#trade-more") &&
    (await page.textContent("#more-btn")).includes("fewer"));
  await page.fill("#f-target", "23540");
  await sleep(60);
  ok("live R green on target", (await page.textContent("#r-val")).trim() === "+3r" &&
    await page.$eval("#r-val", (v) => v.classList.contains("is-pos")));
  ok("$ sub at size 1", (await page.textContent("#r-sub")).includes("$180"));

  /* sign flip: long->short flips the GEOMETRY first (stop now sits on the
     wrong side -> guard), a valid short setup then reads positive; the
     SAME numbers under long read negative. */
  await page.click('#dir-seg [data-dir="short"]');
  await sleep(60);
  ok("flip guards stale geometry", (await page.textContent("#t-hint")).includes("short stop sits below entry"));
  await page.fill("#f-stop", "23500");
  await page.fill("#f-target", "23380");
  await sleep(60);
  ok("valid short reads green", (await page.textContent("#r-val")).trim() === "+1.4r");
  await page.click('#dir-seg [data-dir="long"]');
  await sleep(60);
  /* direction toggle inverts GEOMETRY validity too — a lone flip can never
     read as signed R; it must guard instead. honest red needs a losing px. */
  ok("flip back guards again", (await page.textContent("#r-val")).trim() === "—" &&
    (await page.textContent("#t-hint")).includes("long stop sits above entry"));
  await page.fill("#f-stop", "23420");
  await page.fill("#f-target", "23380");
  await sleep(60);
  ok("losing target reads red", (await page.textContent("#r-val")).trim() === "−2.33r" &&
    await page.$eval("#r-val", (v) => v.classList.contains("is-neg")));

  /* restore long scenario, size scaling, exit precedence */
  await page.fill("#f-entry", "23450");
  await page.fill("#f-stop", "23420");
  await page.fill("#f-target", "23540");
  await page.fill("#f-size", "2");
  await sleep(60);
  ok("$ scales with size", (await page.textContent("#r-sub")).includes("$360"));
  await page.fill("#f-exit", "23500");
  await sleep(60);
  ok("exit wins over target", (await page.textContent("#r-sub")).includes("exit ·") &&
    (await page.textContent("#r-val")).trim() === "+1.67r");

  /* guards */
  await page.fill("#f-stop", "23450");
  await sleep(60);
  ok("stop==entry inline hint", (await page.textContent("#t-hint")).includes("stop equals entry") &&
    await vis(page, "#t-hint"));
  ok("publish blocked while invalid", await page.$eval("#publish-btn", (b) => b.disabled));
  ok("error ring on r-box", await page.$eval("#r-box", (b) => b.classList.contains("is-err")));
  await page.fill("#f-stop", "23600");
  await sleep(60);
  ok("wrong-side hint (long)", (await page.textContent("#t-hint")).includes("long stop sits above entry"));
  await page.click('#dir-seg [data-dir="short"]');
  await page.fill("#f-stop", "23380");           /* below entry = wrong side for short */
  await sleep(60);
  ok("wrong-side hint (short)", (await page.textContent("#t-hint")).includes("short stop sits below entry"));
  await page.click('#dir-seg [data-dir="long"]'); /* stop 23380 under long = valid again */
  await sleep(60);
  ok("hint clears when geometry fixed",
    !(await vis(page, "#t-hint")) && !(await page.$eval("#publish-btn", (b) => b.disabled)));

  /* ---------- screenshots + ai diff ---------- */
  console.log("shots");
  ok("ai hidden without shots", !(await vis(page, "#ai-btn")));
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], "shot.png", { type: "image/png" }));
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await sleep(150);
  ok("paste anywhere attaches thumb", (await page.$$("#shots-row .thumb")).length === 1 &&
    !(await page.$eval("#shots", (s) => s.hidden)));
  ok("attach counter shows 1", (await page.textContent("#shot-count")).trim() === "1");
  ok("ai appears for trade+shots", await vis(page, "#ai-btn"));
  await page.click('#mode-seg [data-m="thought"]');
  ok("ai hides outside trade mode", !(await vis(page, "#ai-btn")));
  await page.click('#mode-seg [data-m="trade"]');
  await page.click("#ai-btn");
  await page.waitForSelector("#diff-dlg[open]", { timeout: 3000 });
  ok("ai diff sheet opens", true);
  ok("diff reads six fields", (await page.$$("#diff-rows .diff-row")).length === 6);
  await page.click(".diff-one[data-k='entry']");
  await sleep(60);
  ok("per-row apply lands value", (await page.inputValue("#f-entry")) === "23452.25");
  await page.click("#diff-dismiss");
  await page.fill("#f-exit", "");            /* clear precedence winner: target must drive R now */
  await page.click("#ai-btn");
  await page.waitForSelector("#diff-dlg[open]", { timeout: 3000 });
  await page.click("#diff-apply");
  await sleep(80);
  ok("apply all fills detected values",
    (await page.inputValue("#f-stop")) === "23418.75" &&
    (await page.inputValue("#f-target")) === "23536.00" &&
    (await page.inputValue("#f-size")) === "2");
  ok("R recomputes post-apply", (await page.textContent("#r-val")).trim() === "+2.5r");

  /* trade publish → card */
  await page.click("#publish-btn");
  await sleep(150);
  const tCard = await page.$eval("#stream .card", (c) => c.textContent);
  ok("trade card renders R + facts", tCard.includes("+2.5r") && tCard.includes("23452.25"));
  ok("prices reset, context kept", (await page.inputValue("#f-entry")) === "" &&
    (await page.inputValue("#f-market")) === "mnq");

  /* toast expiry */
  console.log("toast timer");
  const hidBy = await page.waitForFunction(
    () => document.getElementById("toast").hidden, { timeout: 6000 }).then(() => true).catch(() => false);
  ok("toast auto-expires ~5s", hidBy);

  /* ---------- keyboard grammar ---------- */
  console.log("keyboard");
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press("q");
  ok("n/q/t shortcuts switch modes",
    await page.$eval('#mode-seg [data-m="quote"]', (b) => b.getAttribute("aria-pressed") === "true"));
  await page.click('#mode-seg [data-m="trade"]');
  await page.focus("#f-entry");
  await page.keyboard.press("Enter");
  ok("plain enter never fires a trade",
    (await page.$$("#stream .card")).length === 2 &&
    await page.evaluate(() => document.activeElement?.id) === "f-stop");

  /* ---------- touch targets ---------- */
  console.log("targets");
  const TARGETS = [
    '#mode-seg [data-m="trade"]', '#dir-seg [data-dir="long"]', "#publish-btn",
    "#attach-btn", "#more-btn", ".chip", ".dot-b",
  ];
  for (const sel of TARGETS) {
    const el = await page.$(sel);
    if (!el) { ok(`target ${sel} exists`, false); continue; }
    const d = await targetAtLeast(page, sel);
    ok(`target ≥44 ${sel}`, d.w >= 43.5 && d.h >= 43.5, `${d.w.toFixed(1)}x${d.h.toFixed(1)}`);
  }

  /* ---------- deep states ---------- */
  console.log("deep states");
  await page.goto(URL_ + "?err=1", { waitUntil: "domcontentloaded", timeout: 15000 });
  ok("?err=1 boots invalid geometry", await vis(page, "#t-hint") &&
    await page.$eval("#publish-btn", (b) => b.disabled));
  await page.goto(URL_ + "?pub=trade", { waitUntil: "domcontentloaded", timeout: 15000 });
  const pubCard = await page.$eval("#stream .card", (c) => c.textContent);
  ok("?pub=trade seeds a +3r card", pubCard.includes("+3r") && pubCard.includes("23450"));
  await page.goto(URL_ + "?shots=1", { waitUntil: "domcontentloaded", timeout: 15000 });
  ok("?shots=1 seeds demo rail", (await page.$$("#shots-row .thumb")).length === 2);

  /* virtual time doctrine */
  await page.goto(URL_ + "?at=2026-08-25T09:20", { waitUntil: "domcontentloaded", timeout: 15000 });
  ok("?at freezes clock + announces", !(await page.$eval("#sim-chip", (c) => c.hidden)) &&
    (await page.textContent("#clk-hkt")).startsWith("09:20"));

  /* ---------- mobile 390x844 ---------- */
  console.log("mobile");
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mp = await mctx.newPage();
  await mp.goto(URL_, { waitUntil: "domcontentloaded", timeout: 15000 });
  const top = await mp.$eval("#composer", (el) => el.getBoundingClientRect().top + window.scrollY);
  ok("composer above the fold (<430)", top < 430, `${Math.round(top)}px`);
  ok("no horizontal overflow", await mp.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth + 1));
  ok("kbd hint hidden on touch", await mp.$eval("#kbd-enter", (k) => getComputedStyle(k).display === "none"));
  ok("capture button readable on touch", await mp.$eval("#publish-btn",
    (b) => parseFloat(getComputedStyle(b).fontSize) >= 12));

  ok("zero js errors across run", errors.length === 0, errors.join("; ").slice(0, 160));

  await browser.close();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail) { console.log("failures:\n - " + failures.join("\n - ")); process.exit(1); }
})().catch((e) => { console.error("gate crashed:", e); process.exit(1); });
