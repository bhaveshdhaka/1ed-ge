/* ============================================================
   _verify/rituals.gate.cjs — S04 regression bar (session C11).
   Runs against the LIVE mock (ZEN_BASE overrides for local).
     ZEN_BASE=http://localhost:4399 node rituals.gate.cjs
   Covers: shell contract · structure · frozen chrome grammar ·
   focus engine (wall-clock accuracy, pause/resume, exit-keeps-
   running, early + auto completion, note slide) · soundscapes
   (tap-gated start, dock survives sheet close, volume) ·
   intention flow + evening check-in · rewiring 21-day math ·
   presets/deep-links · keyboard · 44pt targets · mobile 390.
   ============================================================ */
const { makeGate, sleep, vis, targetAtLeast, GRAMMAR, cleanCd } = require("./lib.cjs");

const g = makeGate({ base: process.env.ZEN_BASE, path: "/zen/rituals.html", id: "S04-rituals" });
const { ok, state } = g;
const TIMER_GRAMMAR = /^\d+m \d{2}s$|^\d+s$|^done$/;   // stopwatch exception (DECISIONS)
const DAY_RE = /^\d{2}-[a-z]{3}-\d{4}$/;
const go = async (q = "") => { await state.page.goto(g.url + q, { waitUntil: "networkidle", timeout: 20000 }); return state.page; };

(async () => {
  const page = await g.open();

  /* ---------------- shell ---------------- */
  await go();
  ok("200 on page", true);
  ok("title reads rituals", (await page.title()).includes("rituals"));
  const raw = await (await page.request.get(g.url)).text();
  ok("sprint id comment", raw.includes("S04-rituals") && raw.includes("session C11"));
  ok("feedback annotator mounted", await page.$eval("#fb-toggle", () => true).catch(() => false));
  for (const a of ["tokens", "tokens-light", "base", "frame", "composer", "rail", "rituals"]) {
    const r = await page.request.get(`${g.BASE}/st/css/${a}?v=c11`);
    ok(`css ${a} 200`, r.status() === 200);
  }
  {
    const css = await (await page.request.get(`${g.BASE}/st/css/rituals?v=c11`)).text();
    const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
    ok("rituals.css zero color literals", !/#[0-9a-fA-F]{3,8}\b/.test(body) && !/rgba?\(/i.test(body));
  }
  ok("no framework js", await page.evaluate(() => !window.React && !window.jQuery && !window.Vue));

  /* ---------------- structure ---------------- */
  ok("5 ritual rows", await page.locator(".rt-row").count() === 5);
  ok("rows named", ["quiet", "nature", "exercise", "intentions", "rewiring"].every(
    async (n) => (await page.locator(`.rt-row:has-text("${n}")`).count()) === 1));
  ok("4 navchips", await page.locator(".navchip").count() === 4);
  for (const id of ["sec-practice", "sec-intention", "sec-days", "sec-reading"])
    ok(`#${id} present`, await page.$(`#${id}`));
  ok("count capsule renders", /0 of 5 done/.test(await page.textContent("#rt-count")));
  ok("dayline has 5 ticks", await page.locator("#rt-dayline .fv-ticks span").count() === 5);
  ok("dayline date dd-mon-yyyy", DAY_RE.test(
    cleanCd((await page.textContent("#rt-dayline")).split("·").pop().trim().replace(/^[a-z]{3} /, ""))));
  ok("soundscape launcher", await vis(page, "#snd-open"));
  ok("21 strip cells", await page.locator("#strip21 i").count() === 21);
  ok("strip legend 3 keys", await page.locator(".rew-legend span").count() === 3);
  ok("reading passage present", (await page.locator("#sec-reading blockquote").count()) === 1);
  ok("reading your-line present", (await page.locator(".read-mine").count()) === 1);
  ok("empty notes line ends with period", (await page.textContent("#rew-latest")).trim().endsWith("."));
  ok("devrail presets present", await page.$("#rt-seg"));
  ok("fab hidden on desktop", await page.$eval("#fab-k", (el) => el.hidden));

  /* ---------------- frozen chrome + grammar ---------------- */
  ok("brand present", (await page.textContent(".brand")).includes("1edge"));
  await sleep(1200);
  ok("mkt capsule live", /cme · (open|halt|closed)/.test(await page.textContent("#mkt-label")));
  ok("mkt countdown grammar", GRAMMAR.test(cleanCd(await page.textContent("#mkt-cd"))));
  ok("next-change grammar", GRAMMAR.test(cleanCd(await page.textContent("#next-change b"))));
  ok("clock ticks hkt", /\d{2}:\d{2}/.test(await page.textContent("#clk-hkt")));
  ok("43 strip cells", await page.locator(".day-cell").count() === 43);
  ok("today aria-current", await page.locator('.day-cell[aria-current="date"]').count() === 1);
  const sessLeft = await page.$$eval("#rail .sess-state b", (els) => els.map((e) => e.textContent));
  ok("session countdowns grammar", sessLeft.every((t) => GRAMMAR.test(cleanCd(t))));
  ok("row metas grammar", await page.$$eval(".rt-row .rt-meta", (els) =>
    els.every((e) => /^(done( · \d+m( actual)?)?( · intention set)?|\d+m · .*|one sentence)$/.test(e.textContent.trim()))));

  /* ---------------- focus: accuracy + lifecycle ---------------- */
  const focusOpen = () => page.$eval("#focus", (el) => !el.hidden);      // fixed → offsetParent null, vis() blind
  await page.click('.rt-row[data-id="quiet"]');
  ok("focus opens", await focusOpen());
  ok("focus aria-modal", await page.getAttribute("#focus", "aria-modal") === "true");
  ok("name reads quiet", (await page.textContent("#focus-name")).trim() === "quiet");
  ok("initial 10m 00s", (await page.textContent("#f-time")).trim() === "10m 00s");
  ok("timer grammar at rest", TIMER_GRAMMAR.test((await page.textContent("#f-time")).trim()));
  ok("ring full at rest", await page.getAttribute("#f-prog", "stroke-dashoffset") === "0.00");
  ok("exit target 44pt", (await targetAtLeast(page, "#focus-exit")).h >= 44);
  ok("toggle target 44pt", (await targetAtLeast(page, "#f-toggle")).h >= 44);

  await page.click("#f-toggle");
  await sleep(2100);
  const runTxt = (await page.textContent("#f-time")).trim();
  ok("wall-clock drain ~2s", ["9m 57s", "9m 58s", "9m 59s"].includes(runTxt), runTxt);
  ok("running label pause", (await page.textContent("#f-toggle")).trim() === "pause");
  await page.click("#f-toggle");
  ok("paused sub", (await page.textContent("#f-sub")).trim() === "paused");
  const pausedTxt = (await page.textContent("#f-time")).trim();
  await sleep(1200);
  ok("paused freezes", (await page.textContent("#f-time")).trim() === pausedTxt);
  ok("paused hides row chip", !(await page.$eval('.rt-row[data-id="quiet"] [data-live]', (el) => !el.hidden)));

  /* exit mid-RUN (restart first): session keeps living in the row */
  await page.click("#f-toggle");                        // resume
  await sleep(1100);
  await page.click("#focus-exit");
  ok("overlay closes", !(await focusOpen()));
  const liveSel = '.rt-row[data-id="quiet"] [data-live]';
  ok("row live chip visible", await page.$eval(liveSel, (el) => !el.hidden));
  const liveBefore = (await page.textContent(liveSel)).trim();
  ok("row live grammar", TIMER_GRAMMAR.test(liveBefore), liveBefore);
  await sleep(2100);
  const liveAfter = (await page.textContent(liveSel)).trim();
  ok("row live keeps ticking after exit", liveAfter !== liveBefore, `${liveBefore} → ${liveAfter}`);
  await page.click('.rt-row[data-id="quiet"]');
  ok("re-enter keeps remaining", Math.abs(
    parseInt(liveAfter) - parseInt((await page.textContent("#f-time")).trim())) <= 3,
    `${liveAfter} vs ${(await page.textContent("#f-time")).trim()}`);
  await page.click("#focus-exit");

  /* ---------------- early completion + note slide ---------------- */
  await page.click('.rt-row[data-id="nature"]');
  await page.click("#f-done");
  ok("done state class", (await page.getAttribute("#focus", "class")).includes("is-done"));
  ok("sub reads logged early", (await page.textContent("#f-sub")).trim() === "logged early");
  ok("note form slides in", await page.$eval("#f-noteform", (el) => !el.hidden));
  await sleep(400);                                     // stroke transition 210ms must settle
  {
    const stroke = await page.$eval("#focus .f-ring .pr", (el) => getComputedStyle(el).stroke);
    const up = await page.evaluate(() => {
      const d = document.createElement("div");
      d.style.color = "var(--up)";
      document.body.appendChild(d);
      const c = getComputedStyle(d).color;
      d.remove();
      return c;
    });
    ok("ring flips to up green", stroke === up, `${stroke} vs ${up}`);
  }
  await page.fill("#f-noteform [name=session_note]", "walked the harbor loop.");
  await page.press("#f-noteform [name=session_note]", "Enter");   // return publishes (capture grammar)
  ok("toast confirms", (await page.textContent("#toast-msg")).includes("logged"));
  ok("overlay closed after save", !(await focusOpen()));
  ok("row is-done", (await page.getAttribute('.rt-row[data-id="nature"]', "class")).includes("is-done"));
  ok("meta honest (no minutes under 60s)", /^done$/.test((await page.textContent('.rt-row[data-id="nature"] .rt-meta')).trim()));
  ok("capsule counts 1", (await page.textContent("#rt-count")).trim().startsWith("1 of 5"));
  ok("dayline tick green", (await page.getAttribute("#rt-dayline .fv-ticks span:nth-child(2)", "class")).includes("t-yes"));
  ok("state persisted", await page.evaluate(() => JSON.parse(localStorage.getItem("zen.rt.v1")).done.nature === true));

  /* ---------------- auto completion via ?dur ---------------- */
  await go("?focus=quiet&run=1&dur=3s");               // clamp floors at 5s
  await sleep(6200);
  ok("auto completes", (await page.getAttribute("#focus", "class")).includes("is-done"));
  ok("auto sub", (await page.textContent("#f-sub")).trim() === "session complete");
  ok("auto ring full green", await page.getAttribute("#f-prog", "stroke-dashoffset") === "0");
  ok("short session no fake minutes", !/actual/.test(await page.textContent('.rt-row[data-id="quiet"] .rt-meta')));
  await page.click("#f-toggle");                       // close
  ok("quiet done after auto", (await page.textContent("#rt-count")).trim().startsWith("2 of 5"));

  /* real minutes: a >=60s session records actual time */
  await go("?focus=exercise&run=1&dur=70s");
  await sleep(71500);
  ok("70s auto completes", (await page.getAttribute("#focus", "class")).includes("is-done"));
  ok("minutes recorded", /done · 2m actual/.test(await page.textContent('.rt-row[data-id="exercise"] .rt-meta')),
    await page.textContent('.rt-row[data-id="exercise"] .rt-meta'));
  await page.click("#f-toggle");
  ok("capsule 3 of 5", (await page.textContent("#rt-count")).trim().startsWith("3 of 5"));

  /* ---------------- soundscapes ---------------- */
  ok("dock hidden before any tap", await page.$eval("#snd-dock", (el) => el.hidden));
  await page.click("#snd-open");
  ok("sheet opens", await page.$eval("#snd-sheet", (d) => d.open));
  ok("5 scenes", await page.locator(".snd-row").count() === 5);
  ok("rain + brown present", await page.locator('.snd-row[data-id="rain"]').count() === 1 &&
                              await page.locator('.snd-row[data-id="brown"]').count() === 1);
  ok("scenes role radio", await page.getAttribute('.snd-row[data-id="rain"]', "role") === "radio");
  ok("volume named input", await page.locator('[name=soundscape_volume]').count() === 1);
  ok("volume default 55", await page.inputValue('[name=soundscape_volume]') === "55");
  await sleep(350);                                     // pop-in (scale .98) must settle before measuring
  ok("volume target >=44", (await targetAtLeast(page, ".snd-vol")).h >= 44);
  await page.click('.snd-row[data-id="rain"]');
  await sleep(500);
  ok("row checked", await page.getAttribute('.snd-row[data-id="rain"]', "aria-checked") === "true");
  ok("dock visible", await page.$eval("#snd-dock", (el) => !el.hidden));
  await page.click("#snd-form button[type=submit]");
  ok("audio survives sheet close", await page.$eval("#snd-dock", (el) => !el.hidden));
  {
    const dock = await page.locator("#snd-dock").boundingBox();
    const fb = await page.locator("#fb-toggle").boundingBox();
    ok("dock stacked above annotator", dock.y + dock.height <= fb.y + 1, JSON.stringify({ dock: dock.y, fb: fb.y }));
  }
  await page.click("#snd-dock");
  ok("dock reopens sheet", await page.$eval("#snd-sheet", (d) => d.open));
  await page.click("#snd-stop");
  ok("stop clears dock", await page.$eval("#snd-dock", (el) => el.hidden));
  ok("checked cleared", await page.getAttribute('.snd-row[data-id="rain"]', "aria-checked") === "false");
  await page.click("#snd-form button[type=submit]");

  /* ---------------- intention flow ---------------- */
  await page.fill('[name=intention_text]', "protect the first hour.");
  await page.click("#intent-form button[type=submit]");
  ok("intention quote renders", (await page.locator("#intent-panel blockquote").count()) === 1);
  ok("cite has hkt time", /— set \d{2}:\d{2} hkt/.test(await page.textContent("#intent-panel cite")));
  ok("chip set unchecked", (await page.textContent("#intent-chip")).includes("unchecked"));
  ok("intentions row done", (await page.getAttribute('.rt-row[data-id="intentions"]', "class")).includes("is-done"));
  await page.click("#intent-edit");
  ok("rewrite returns form", await page.$("#intent-form"));
  await page.fill('[name=intention_text]', "hold through london.");
  await page.click("#intent-form button[type=submit]");
  await page.click('[data-v="met"]');
  ok("seg syncs hidden input", await page.$eval('[data-sync="checkin_verdict"] input', (i) => i.value) === "met");
  await page.fill('[name=checkin_note]', "held until the sweep.");
  await page.click("#ck-save");
  ok("verdict chip met", await page.locator("#intent-chip .vc-met").count() === 1);
  ok("checkin note shows", (await page.textContent("#intent-panel")).includes("held until the sweep."));

  /* ---------------- rewiring / 21 days ---------------- */
  ok("day counter 14", (await page.textContent("#rew-count")).includes("day 14"));
  ok("ends date format", DAY_RE.test((await page.textContent("#rew-end")).replace("ends ", "")));
  ok("streak capsule 11/21", (await page.textContent("#rew-streak")).trim() === "11/21");
  {
    const cls = await page.$$eval("#strip21 i", (els) => els.map((e) => e.className));
    ok("7 prior cells", cls.filter((c) => c.includes("is-prior")).length === 7);
    ok("11 done cells (today pending)", cls.filter((c) => c.includes("is-done")).length === 11);
    ok("2 missed cells", cls.filter((c) => c.includes("is-missed")).length === 2);
  }
  await page.click("#rew-log");
  ok("rw sheet opens", await page.$eval("#rw-sheet", (d) => d.open));
  ok("rw textarea named", await page.locator('[name=rewire_note]').count() === 1);
  await page.fill("[name=rewire_note]", "rehearsed the open.");
  await page.click("#rw-done-btn");
  ok("rw mark done row", (await page.getAttribute('.rt-row[data-id="rewiring"]', "class")).includes("is-done"));
  ok("today cell filled", (await page.getAttribute("#strip21 i:last-child", "class")).includes("is-done"));
  ok("streak capsule 12/21 after mark", (await page.textContent("#rew-streak")).trim() === "12/21");
  await page.keyboard.press("Escape");                  // mark-done keeps the sheet open by design
  await page.click("#rew-log");
  await page.fill("[name=rewire_note]", "rehearsed the open twice.");
  await page.click("#rw-form button[type=submit]");
  ok("latest note line", (await page.textContent("#rew-latest")).includes("rehearsed the open twice."));
  ok("today cell has-note", (await page.getAttribute("#strip21 i:last-child", "class")).includes("has-note"));

  /* ---------------- presets + deep links ---------------- */
  await go("?rituals=all");
  ok("preset all 5/5", (await page.textContent("#rt-count")).trim().startsWith("5 of 5"));
  ok("preset all rows done", await page.$$eval(".rt-row", (els) => els.every((e) => e.classList.contains("is-done"))));
  ok("preset all capsule up", (await page.getAttribute("#rt-count", "class")).includes("capsule-up"));
  await go("?rituals=none");
  ok("preset none 0/5", (await page.textContent("#rt-count")).trim().startsWith("0 of 5"));
  await go("?focus=intentions");
  ok("text variant hides ring", await page.$eval("#f-ringwrap", (el) => el.hidden));
  ok("text variant write surface", await vis(page, "#f-intent"));
  ok("text variant hides foot", await page.$eval("#f-foot", (el) => el.hidden));
  ok("write prefilled", (await page.inputValue("#f-intent")).length > 0);
  await page.click("#focus-exit");
  await go("?focus=rewiring&run=1");
  ok("run autostarts", (await page.textContent("#f-toggle")).trim() === "pause");
  await page.click("#focus-exit");

  /* ---------------- keyboard ---------------- */
  await page.keyboard.press("Escape");
  await go();
  await page.keyboard.press("/");
  ok("/ opens palette", await page.$eval("#palette", (d) => d.open));
  await page.keyboard.press("Escape");
  await sleep(150);                                     // let deferred focus timers settle
  await page.keyboard.press("s");
  ok("s opens soundscape", await page.$eval("#snd-sheet", (d) => d.open),
    "active=" + await page.evaluate(() => document.activeElement.tagName + "#" + document.activeElement.id));
  await page.keyboard.press("Escape");
  await page.keyboard.press("g");
  await page.keyboard.press("p");
  await sleep(700);
  {
    const top = await page.$eval("#sec-practice", (el) => el.getBoundingClientRect().top);
    ok("g p lands practice under chrome", top > 100 && top < 320, String(top));   // scroll-margin 168
  }
  await page.keyboard.press("g");
  await page.keyboard.press("w");
  await sleep(700);
  {
    const y = await page.$eval("#sec-days", (el) => el.getBoundingClientRect().top);
    ok("g w jumps to 21 days", y > -80 && y < 300, String(y));
  }

  /* ---------------- reduced motion ---------------- */
  {
    const { chromium: ch2 } = require("playwright-core");
    const b2 = await ch2.launch();
    const pg = await b2.newPage({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
    const rerr = [];
    pg.on("pageerror", (e) => rerr.push(String(e)));
    await pg.goto(g.url, { waitUntil: "networkidle" });
    ok("[rm] page loads clean", rerr.length === 0, rerr.join("|"));
    ok("[rm] eq bars still", await pg.evaluate(() => {
      const i = document.createElement("span");
      i.className = "eq";
      i.innerHTML = "<i></i>";
      document.body.appendChild(i);
      return getComputedStyle(i.querySelector("i")).animationName === "none";
    }));
    await b2.close();
  }

  /* ---------------- targets (in-dialog controls need the sheet OPEN) -- */
  for (const sel of [".rt-row", "#snd-open", "#rew-log", ".navchip"]) {
    const t = await targetAtLeast(page, sel);
    ok(`44pt ${sel}`, t.h >= 44 && t.w >= 44, JSON.stringify(t));
  }
  await page.click("#snd-open");
  await sleep(350);                                     // pop-in settle
  for (const sel of [".snd-row", "#snd-stop", ".snd-vol"]) {
    const t = await targetAtLeast(page, sel);
    ok(`44pt ${sel}`, t.h >= 44, JSON.stringify(t));
  }
  await page.click("#snd-form button[type=submit]");

  /* ---------------- mobile 390 ---------------- */
  {
    const b2 = await (require("playwright-core")).chromium.launch();
    const ctx = await b2.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await ctx.newPage();
    const merr = [];
    mp.on("pageerror", (e) => merr.push(String(e)));
    await mp.goto(g.url, { waitUntil: "networkidle" });
    ok("[m] no horizontal scroll", await mp.evaluate(() => document.documentElement.scrollWidth <= 391));
    ok("[m] strip21 fits", await mp.$eval("#strip21", (el) => el.scrollWidth <= el.clientWidth + 2));
    ok("[m] fab visible coarse", await mp.$eval("#fab-k", (el) => !el.hidden));
    ok("[m] rows full width", await mp.$eval(".rt-list", (el) => el.getBoundingClientRect().width > 300));
    await mp.goto(g.url + "?focus=quiet", { waitUntil: "networkidle" });
    ok("[m] focus fits", await mp.$eval("#focus", (el) => el.getBoundingClientRect().width <= 391));
    ok("[m] ring inside viewport", await mp.$eval(".f-ringwrap", (el) => el.getBoundingClientRect().right <= 391));
    ok("[m] no page errors", merr.length === 0, merr.join("|"));
    await b2.close();
  }

  ok("no page errors (desktop)", state.errors.length === 0, state.errors.join("|"));
  await g.done();
})().catch((e) => { console.error("gate crashed:", e); process.exit(1); });
