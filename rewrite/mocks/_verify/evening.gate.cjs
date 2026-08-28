#!/usr/bin/env node
/* ============================================================
   evening.gate.cjs — S05 standing regression bar · session C12
   Runs against the LIVE url (house standard). lib.cjs harness.
   ZEN_BASE=https://mock.1ed.ge node evening.gate.cjs
   ============================================================ */
const { makeGate, sleep, vis, targetAtLeast } = require("./lib.cjs");

const g = makeGate({ path: "/zen/evening.html", id: "S05-evening" });
const ok = g.ok;
let p;
/* evening grammar extends S01 r2.2 with day units on grace windows */
const CD = /^(<1m|\d+m|\d+h \d+m|\d+d \d+h)$/;
const clean = (s) => s.replace(/^(in|due in|overdue|grace) /, "").replace(/ ·.*$/, "").trim();
const okCd = (name, text) => {
  const t = clean(text);
  if (/^logged$/.test(t)) { ok(`${name} logged`, true); return; }
  ok(`${name} grammar "${t}"`, CD.test(t), text.trim());
};
const toastUp = () => p.$eval("#toast", (el) => !el.hidden).catch(() => false);

(async () => {
  await g.open();
  p = g.state.page;

  /* ---------------- shell ---------------- */
  await g.shell({ titleIncludes: "evening", sprintId: "S05-evening" });
  /* mockd serves extensionless only — fetch + literal check on /st/css/evening */
  ok("evening css serves 200", (await p.request.get(`${g.BASE}/st/css/evening?v=c12`)).status() === 200);
  await g.noColorLiterals("evening", "c12");

  /* ---------------- sections + nav ---------------- */
  for (const id of ["ev-band", "sec-recap", "sec-reflect", "sec-queue", "sec-review", "sec-import", "sec-payout"])
    ok(`section ${id} present`, await p.$(`#${id}`) !== null);
  ok("6 navchips", await p.locator(".navchip").count() === 6);
  ok("q-badge hidden when… rendered with count", await vis(p, "#q-badge"));

  /* ---------------- evening switch ---------------- */
  const evSub = await p.textContent("#ev-sub");
  ok("ev-band names cme state", /cme (closed|still (open|halt))/.test(evSub), evSub);
  okCd("mkt countdown", await p.textContent("#mkt-cd"));
  ok("cockpit btn → index", await p.$eval("#to-cockpit", (b) => b.textContent.includes("cockpit")));

  /* ---------------- recap ---------------- */
  ok("day r populated", /^[+−-]/.test((await p.textContent("#rc-r")).trim()), await p.textContent("#rc-r"));
  ok("trades count 4", (await p.textContent("#rc-n")) === "4");
  ok("best/worst filled", (await p.textContent("#rc-best")).includes("r") && (await p.textContent("#rc-worst")).includes("r"));

  /* ---------------- reflect form (real form, named input) ---------------- */
  ok("refl textarea named", await p.$eval("#refl-ta", (t) => t.name === "reflection"));
  ok("refl form is a <form>", await p.$eval("#refl-form", (f) => f.tagName === "FORM"));
  await p.fill("#refl-ta", "gate: three honest lines.");
  await p.click("#log-btn");
  await sleep(250);
  ok("submit → chip logged", (await p.textContent("#refl-chip")).includes("logged"));
  ok("submit → queue drops to 3", (await p.textContent("#q-count")).includes("3"));
  okCd("refl chip grammar", await p.textContent("#refl-chip"));

  /* ai draft stub on a fresh load */
  await p.goto(g.url, { waitUntil: "networkidle" });
  await p.click("#draft-btn");
  await sleep(1100);
  ok("ai draft inserts text", (await p.inputValue("#refl-ta")).length > 40);

  /* ---------------- accountability queue ---------------- */
  ok("queue rows rendered", await p.locator(".qrow").count() >= 3);
  ok("reflections sort first", await p.$eval(".qrow", (r) => r.textContent.includes("reflection")));
  const cds = await p.locator(".q-cd").allTextContents();
  for (let i = 0; i < Math.min(cds.length, 3); i++) okCd(`q-cd[${i}]`, cds[i]);
  ok("q-dot severity only on dot", await p.$eval(".qrow .q-dot", (d) => getComputedStyle(d).borderRadius === "999px"));
  /* day sheet clears a row */
  await p.click(".qrow[data-q^='refl']");
  ok("day sheet opens", await p.$eval("#sh", (d) => d.open));
  ok("sheet input named", await p.$eval("#sh-ta", (t) => t.name === "day_reflection"));
  await p.fill("#sh-ta", "gate: late but honest.");
  await p.click("#sh-form button[type=submit]");
  await sleep(250);
  ok("sheet clears row → 3 left", (await p.textContent("#q-count")).includes("3"));
  /* review row jumps */
  await p.click(".qrow[data-q^='rev']");
  await sleep(600);
  const revY = await p.$eval("#sec-review", (el) => Math.abs(el.getBoundingClientRect().top) < 300);
  ok("review row jumps to section", revY);
  /* empty state param */
  await p.goto(g.url + "?queue=empty", { waitUntil: "networkidle" });
  const emptyTxt = await p.textContent("#q-box");
  ok("empty state one line, ends with period", /accountability clear.*\.$/s.test(emptyTxt.trim()), emptyTxt.trim());

  /* ---------------- review (svg, no libs) ---------------- */
  await p.goto(g.url, { waitUntil: "networkidle" });
  ok("week hist svg", await p.locator("#rv-hist svg").count() === 1);
  ok("week runs = 10 cells", await p.locator("#rv-runs .run-cell").count() === 10);
  ok("heat 4 rows", await p.locator("#rv-heat .heat-row").count() === 4);
  ok("violations listed", await p.locator("#rv-viol .viol-row").count() >= 2);
  ok("narrative named input", await p.$eval("#rv-ta", (t) => t.name === "narrative"));
  ok("no chart libs", await p.evaluate(() => !window.Chart && !window.d3));
  await p.click("[data-view=month]");
  ok("month runs = 25 cells", await p.locator("#rv-runs .run-cell").count() === 25);
  await p.click("#cmp-btn");
  ok("deltas shown on cmp", await p.locator(".delta:not([hidden])").count() >= 2);
  await p.click("#rv-form button[type=submit]");
  await sleep(250);
  ok("narrative save toast", await toastUp());

  /* ---------------- csv import ---------------- */
  await p.goto(g.url, { waitUntil: "networkidle" });
  ok("dropzone renders", await vis(p, "#dz"));
  ok("file input real", await p.$eval("#dz-file", (i) => i.type === "file"));
  await p.setInputFiles("#dz-file", { name: "t.csv", mimeType: "text/csv", buffer: Buffer.from("csv") });
  await sleep(250);
  ok("preview 9 rows", await p.locator(".csv-table tbody tr").count() === 9);
  ok("summary counts", (await p.textContent(".cs-counts")).includes("1 conflict"));
  /* 44pt-ish targets on merge actions */
  const mergeT = await targetAtLeast(p, "#csv-confirm");
  ok("merge btn ≥40pt target", mergeT.h >= 40, `${mergeT.h}px`);
  /* conflict skip */
  await p.click("tr.is-conflict");
  await sleep(250);
  ok("conflict skip → 8 trips", (await p.textContent(".cs-counts")).includes("8"));
  await p.click("tr.is-conflict");
  await sleep(250);
  /* confirm → mental-stop sheet */
  await p.click("#csv-confirm");
  await sleep(250);
  ok("mental-stop sheet opens", await p.$eval("#ms", (d) => d.open));
  ok("ms radios named", await p.locator("#ms-body input[type=radio]").count() >= 4);
  await p.click("#ms-form button[type=submit]");
  await sleep(250);
  ok("merged card", (await p.textContent("#csv-panel")).includes("imported"));
  ok("another resets to dropzone", await (async () => { await p.click("#csv-again"); await sleep(200); return vis(p, "#dz"); })());

  /* pinned states */
  for (const [q, needle] of [["?csv=preview", "merge"], ["?csv=conflict", "conflict"], ["?csv=merged", "imported"], ["?csv=drop", "drop tradovate"]]) {
    await p.goto(g.url + q, { waitUntil: "networkidle" });
    ok(`pin ${q}`, (await p.textContent("#csv-panel")).toLowerCase().includes(needle));
  }

  /* mobile: csv table horizontal scroll inside wrapper */
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(g.url + "?csv=preview", { waitUntil: "networkidle" });
  ok("csv scrolls in wrapper on 390", await p.evaluate(() => {
    const el = document.querySelector(".csv-scroll");
    return el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX === "auto";
  }));
  ok("no page-level x overflow on 390", await p.evaluate(() => document.documentElement.scrollWidth <= 391));

  /* ---------------- payout ---------------- */
  await p.goto(g.url, { waitUntil: "networkidle" });
  ok("payout form real", await p.$eval("#pay-form", (f) => f.tagName === "FORM"));
  ok("acct select named", await p.$eval("#pay-acct", (s) => s.name === "account"));
  ok("amt named", await p.$eval("#pay-amt", (i) => i.name === "amount"));
  ok("date named + defaulted", await p.$eval("#pay-date", (i) => i.name === "date" && !!i.value));
  await p.fill("#pay-amt", "2000");
  ok("hint equity math", (await p.textContent("#pay-hint")).includes("$50,400"), await p.textContent("#pay-hint"));
  ok("hint cushion above", (await p.textContent("#pay-hint")).includes("above threshold"));
  await p.selectOption("#pay-acct", "eval-b");
  ok("eval-b has no threshold copy", (await p.textContent("#pay-hint")).includes("no payout threshold"));
  await p.click("#pay-form button[type=submit]");
  await sleep(250);
  ok("payout submit toast", await toastUp());

  /* ---------------- pinned obligation states ---------------- */
  for (const [q, needle] of [["?state=due", "due"], ["?state=overdue", "overdue"], ["?state=done", "logged"]]) {
    await p.goto(g.url + q, { waitUntil: "networkidle" });
    ok(`pin ${q}`, (await p.textContent("#refl-chip")).includes(needle));
  }

  /* ---------------- keyboard: palette + g-chords ---------------- */
  await p.goto(g.url, { waitUntil: "networkidle" });
  await p.keyboard.press("/");
  await sleep(200);
  ok("palette opens on /", await p.$eval("#palette", (d) => d.open));
  await p.keyboard.press("Escape");
  await sleep(400);
  await p.keyboard.press("g"); await p.keyboard.press("i");
  await sleep(600);
  ok("g i jumps to import", await p.evaluate(() => Math.abs(document.getElementById("sec-import").getBoundingClientRect().top) < 300));
  await p.keyboard.press("g"); await p.keyboard.press("p");
  await sleep(600);
  ok("g p jumps to payout", await p.evaluate(() => Math.abs(document.getElementById("sec-payout").getBoundingClientRect().top) < 300));

  /* ---------------- touch targets ---------------- */
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(g.url, { waitUntil: "networkidle" });
  for (const sel of [".navchip", "#log-btn", ".qrow", "#draft-btn"]) {
    const t = await targetAtLeast(p, sel);
    ok(`${sel} ≥44pt target`, t.h >= 44 && t.w >= 44, `${Math.round(t.w)}x${Math.round(t.h)}`);
  }

  await g.done();
})().catch((e) => { console.error("gate crashed:", e); process.exit(1); });
