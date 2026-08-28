/* ============================================================
   S06-secondary gate — accounts / library / media / settings.
   Runs against the LIVE deploy (SESSIONS.md gate protocol).
   Acceptance: palette reachability ≤2 actions · stage timeline
   6 stages no wrap-break · reorder buttons-only · passkey
   register/revoke with type-to-confirm (no confirm()) · house
   standards (annotator, real forms, 44pt targets, grammar,
   zero color literals, ?at freeze).
   ============================================================ */
const { makeGate } = require("./lib.cjs");
const g = makeGate({ path: "/zen/accounts.html", id: "S06-secondary" });
const CD_GRAMMAR = /^(?:(\d+)d )?(?:(\d+)h )?\d+m$|^<1m$/;
const raw = {};

async function shellFor(path, titleFrag) {
  const url = g.BASE + path;
  const resp = await g.state.page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
  g.ok(`[${path}] 200`, resp.status() === 200, String(resp.status()));
  g.ok(`[${path}] title reads "${titleFrag}"`, (await g.state.page.title()).includes(titleFrag));
  raw[path] = await (await g.state.page.request.get(url)).text();
  g.ok(`[${path}] sprint id comment`, raw[path].includes("S06-secondary"));
  g.ok(`[${path}] feedback annotator mounted`, await g.state.page.$eval("#fb-toggle", () => true).catch(() => false));
  await g.state.page.waitForTimeout(400);
}

(async () => {
  const page = await g.open();

  /* ---------- accounts ---------- */
  await shellFor("/zen/accounts.html", "accounts");
  g.ok("[accounts] 6 lifecycle cards", (await page.$$(".acct")).length === 6);
  g.ok("[accounts] 36 stage slots (6×6)", (await page.$$(".stl-slot")).length === 36);
  const rows = await page.$$eval(".stl", (tls) =>
    tls.map((t) => new Set([...t.querySelectorAll(".stl-lab")].map((e) => Math.round(e.getBoundingClientRect().top))).size));
  g.ok("[accounts] timelines single row (no wrap-break)", rows.length === 6 && rows.every((n) => n === 1), JSON.stringify(rows));
  g.ok("[accounts] all 6 lifecycle stages on the book", await page.$$eval(".state-chip", (els) => {
    const s = new Set(els.map((e) => [...e.classList].find((c) => c.startsWith("s-"))));
    return ["s-eval", "s-funded", "s-buffer", "s-payout", "s-failed", "s-paused"].every((x) => s.has(x));
  }));
  g.ok("[accounts] equity sparklines render", (await page.$$(".spark polyline")).length === 6);
  await page.click(".acct >> nth=0 >> [data-rules]");
  g.ok("[accounts] rules disclosure opens read-dense", await page.$eval(".acct >> nth=0 >> .rules-disc", (el) => el.classList.contains("is-open"))
    && (await page.$$(".acct >> nth=0 >> .rule-line")).length >= 3);
  await page.click(".acct >> nth=0 >> [data-edit]");
  g.ok("[accounts] edit sheet is a real form (named inputs)", await page.$eval("#sh", (el) => el.open)
    && !!(await page.$("#sh input[name='name']")) && !!(await page.$("#sh input[name='stage']")));
  await page.click("#sh [data-v='failed']");
  g.ok("[accounts] seg syncs named hidden input", await page.$eval("#sh input[name='stage']", (i) => i.value === "failed"));
  await page.click("#sh-form button[type='submit']");
  g.ok("[accounts] save applies to card", await page.$eval(".acct >> nth=0 >> .state-chip", (el) => el.textContent.trim() === "failed"));
  await page.keyboard.press("Control+k");
  await page.click(".pal-item:has-text('media')");
  await page.waitForURL("**/zen/media.html", { timeout: 8000 }).catch(() => {});
  g.ok("[accounts] palette → media = 2 actions", page.url().endsWith("/zen/media.html"));

  /* ---------- library ---------- */
  await shellFor("/zen/library.html", "library");
  g.ok("[library] habits shelf rows", (await page.$$(".lib-row")).length === 5);
  const first = await page.$eval(".lib-row >> nth=0 >> .lib-name", (e) => e.textContent);
  await page.click(".lib-row >> nth=0 >> [data-move='down']");
  g.ok("[library] reorder = buttons only (no dnd)", first !== (await page.$eval(".lib-row >> nth=0 >> .lib-name", (e) => e.textContent)));
  g.ok("[library] no drag-drop wiring", !/draggable|dragstart|touchmove/.test(raw["/zen/library.html"].replace(/\/\*[\s\S]*?\*\//g, "")));
  g.ok("[library] active switch toggles", await page.$eval(".lib-row >> nth=0 >> .switch", (el) => {
    const before = el.getAttribute("aria-checked"); el.click();
    return el.getAttribute("aria-checked") !== before;
  }));
  await page.click("#lib-seg [data-tab='quotes']");
  g.ok("[library] quotes shelf renders", (await page.$$(".lib-quote")).length === 5);
  await page.click("#add-item");
  g.ok("[library] add sheet: real form, named fields", await page.$eval("#sh", (el) => el.open)
    && !!(await page.$("#sh textarea[name='name']")) && !!(await page.$("#sh input[name='active']")));
  await page.click("#sh-cancel");
  await page.goto(g.BASE + "/zen/library.html?tab=rules", { waitUntil: "networkidle" });
  g.ok("[library] ?tab=rules deep link", await page.$eval("#lib-seg [data-tab='rules']", (e) => e.getAttribute("aria-pressed") === "true"));

  /* ---------- media ---------- */
  await shellFor("/zen/media.html", "media");
  g.ok("[media] 12 svg thumbs (3-col grid)", (await page.$$(".mthumb svg")).length === 12);
  g.ok("[media] attached-day chips", (await page.$$(".mchip")).length === 9);
  g.ok("[media] storage usage line", await page.$eval("#usage-cap", (e) => /files · .*mb of .*gb/.test(e.textContent)));
  await page.click(".mthumb >> nth=2");
  g.ok("[media] detail sheet: alt + attach-day named inputs", await page.$eval("#sh", (el) => el.open)
    && !!(await page.$("#sh input[name='alt']")) && !!(await page.$("#sh input[name='attach_day']")));
  await page.fill("#sh input[name='attach_day']", "2026-08-21");
  await page.click("#sh-form button[type='submit']");
  g.ok("[media] attach-to-day applies chip", await page.$eval(".mthumb >> nth=2 >> .mchip", (e) => e.textContent.includes("21-aug-2026")).catch(() => false));
  await page.click("#media-seg [data-f='unattached']");
  g.ok("[media] filter narrows the grid", (await page.$$(".mthumb")).length === 2);
  const mediaEmpty = await page.evaluate(async () => {
    const u = new URL(location); u.searchParams.set("empty", "1");
    const html = await (await fetch(u.href)).text();
    return html;
  });
  g.ok("[media] ?empty state wired", mediaEmpty.includes("empty=1"));

  /* ---------- settings ---------- */
  await shellFor("/zen/settings.html", "settings");
  g.ok("[settings] 5 numbered sections", (await page.$$("section.rail-sec")).length === 5);
  g.ok("[settings] display tz = real form, named select", !!(await page.$("#tz-form select[name='tz']")));
  g.ok("[settings] capture toggles (future)", (await page.$$("#sec-capture .switch")).length === 2
    && raw["/zen/settings.html"].includes("future"));
  await page.click("#pk-add");
  await page.fill("#sh input[name='pk_name']", "ipad mini");
  await page.click("#sh-form button[type='submit']");
  g.ok("[settings] register adds passkey row", await page.$eval("#pk-list .lib-row >> nth=0 >> .lib-name", (e) => e.textContent.includes("ipad mini")));
  await page.click("#pk-list [data-revoke] >> nth=0");
  g.ok("[settings] revoke: type-to-confirm gate closed", await page.$eval("#sh", (el) => el.open)
    && await page.$eval("#sh button[type='submit']", (b) => b.disabled));
  await page.fill("#sh input[name='confirm']", "revoke");
  g.ok("[settings] typing intent opens the gate", await page.$eval("#sh button[type='submit']", (b) => !b.disabled));
  const revoked = await page.$eval("#sh .sh-sub", (e) => e.textContent);
  await page.click("#sh-form button[type='submit']");
  g.ok("[settings] revoke removes the row", !(await page.$eval("#pk-list", (l, n) => l.textContent.includes(n), revoked)));
  const script = raw["/zen/settings.html"].replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  g.ok("[settings] zero confirm() calls", !/\bconfirm\s*\(/.test(script));
  g.ok("[settings] admin secret status row", !!(await page.$("#secret-chip")));
  await page.goto(g.BASE + "/zen/settings.html?secret=unset", { waitUntil: "networkidle" });
  g.ok("[settings] ?secret=unset flips status", await page.$eval("#secret-chip", (e) => e.textContent === "unset" && e.className.includes("s-failed")));
  await page.goto(g.BASE + "/zen/settings.html?pk=0", { waitUntil: "networkidle" });
  g.ok("[settings] ?pk=0 empty state", await page.$eval("#pk-list", (l) => l.textContent.includes("no passkeys — add one")));

  /* ---------- shared house standards on mobile 390 ---------- */
  const ctx390 = await g.state.browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await ctx390.newPage();
  await m.goto(g.BASE + "/zen/library.html", { waitUntil: "networkidle" });
  for (const [name, sel] of [
    ["library step-btn ≥44", ".lib-row >> nth=1 >> [data-move='up']"],
    ["library switch ≥44", ".lib-row >> nth=1 >> .switch"],
  ]) {
    const t = await g.targetAtLeast(m, sel);
    g.ok(`[390] ${name}`, t.w >= 43.5 && t.h >= 43.5, `${Math.round(t.w)}×${Math.round(t.h)}`);
  }
  await m.goto(g.BASE + "/zen/accounts.html", { waitUntil: "networkidle" });
  for (const [name, sel] of [
    ["accounts rules disc-btn ≥44", ".acct >> nth=0 >> .disc-btn"],
    ["accounts edit icon-btn ≥44", ".acct >> nth=0 >> .acct-edit"],
  ]) {
    const t = await g.targetAtLeast(m, sel);
    g.ok(`[390] ${name}`, t.w >= 43.5 && t.h >= 43.5, `${Math.round(t.w)}×${Math.round(t.h)}`);
  }
  g.ok("[390] accounts: controls never leave the viewport", await m.$eval(".acct >> nth=0 >> .acct-foot", (el) => {
    const r = el.getBoundingClientRect(); return r.right <= 391 && r.left >= -1;
  }));
  const cd = await m.$eval("#mkt-cd", (e) => e.textContent);
  g.ok("[390] countdown grammar (S01 r2.2 + S05)", CD_GRAMMAR.test(cd), cd);
  await m.goto(g.BASE + "/zen/accounts.html?at=2026-08-25T09:20", { waitUntil: "networkidle" });
  g.ok("[?at] freeze announces sim chip", await m.$eval("#sim-chip", (e) => !e.hidden));
  g.ok("[?at] chrono band still renders", await m.$eval("#band", (e) => e.dataset.open !== ""));
  await ctx390.close();

  /* ---------- shared css: zero literals ---------- */
  await g.noColorLiterals("secondary.css", "c13");

  await g.done();
})().catch((e) => { console.error("gate crashed:", e); process.exit(1); });
