// 1edge feedback annotator — vanilla, no deps. Every screen includes this.
// Tap pill → tap any element → write → submit. Notes POST to the server
// (JSONL on PVC): never lost, no expiry, anchored to the exact element.
// Tap-and-HOLD the pill to read existing notes on this page.

const API = "/api/feedback";
const page = location.pathname.replace(/\/index\.html$/, "/") || "/";

function sel(el) {
  const parts = [];
  let e = el, depth = 0;
  while (e && e.nodeType === 1 && e.tagName !== "BODY" && depth < 6) {
    let p = e.tagName.toLowerCase();
    if (e.id && /^[a-z][\w-]*$/i.test(e.id)) { parts.unshift(p + "#" + e.id); break; }
    const sibs = e.parentElement ? [...e.parentElement.children].filter(c => c.tagName === e.tagName) : [];
    if (sibs.length > 1) p += `:nth-of-type(${sibs.indexOf(e) + 1})`;
    parts.unshift(p);
    e = e.parentElement; depth++;
  }
  return parts.join(">");
}

function docRect(el) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

async function loadNotes() {
  try {
    const res = await fetch(`${API}?page=${encodeURIComponent(page)}`);
    return (await res.json()).notes ?? [];
  } catch { return []; }
}

function toast(msg, err) {
  const t = document.createElement("div");
  t.className = "fb-toast" + (err ? " err" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

const css = `
#fb-toggle{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:9998;display:flex;align-items:center;gap:6px;height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--line2);background:color-mix(in srgb,var(--bg-raise) 92%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:var(--dim);font:inherit;font-size:var(--text-xs)}
#fb-toggle.on{border-color:var(--accent);color:var(--accent)}
#fb-toggle b{color:var(--ink);font-weight:700}
body.fb-mode *{cursor:crosshair!important}
.fb-hl{outline:2px solid var(--accent)!important;outline-offset:2px}
.fb-flash{animation:fbflash 1.6s ease-out 1}
@keyframes fbflash{0%{background-color:color-mix(in srgb,var(--accent) 35%,transparent)}100%{background-color:transparent}}
dialog.fb-sheet{width:min(420px,92vw);margin:auto auto calc(env(safe-area-inset-bottom,0px) + 14px);padding:var(--s4);background:var(--surface-solid);border:none;border-radius:var(--radius-lg);box-shadow:inset 0 0 0 1px var(--line2),var(--shadow-float);color:var(--ink)}
dialog.fb-sheet::backdrop{background:rgba(4,5,7,.55)}
dialog.fb-list{width:min(520px,94vw);padding:var(--s4);background:var(--surface-solid);border:none;border-radius:var(--radius-lg);box-shadow:inset 0 0 0 1px var(--line2),var(--shadow-float);color:var(--ink)}
dialog.fb-list::backdrop{background:rgba(4,5,7,.55)}
.fb-ctx{font-size:var(--text-2xs);color:var(--faint);margin:0 0 var(--s2);word-break:break-all}
.fb-sheet textarea{width:100%;min-height:88px;background:var(--inset);border:1px solid var(--line2);border-radius:var(--radius-sm);color:var(--ink);font:inherit;font-size:var(--text-sm);padding:10px;resize:vertical}
.fb-actions{display:flex;gap:var(--s2);justify-content:flex-end;margin-top:var(--s3)}
.fb-btn{height:32px;padding:0 12px;border-radius:var(--radius-sm);font-size:var(--text-xs);display:inline-flex;align-items:center;font-family:inherit;font-weight:600}
.fb-primary{background:var(--accent);color:#071120}
.fb-ghost{border:1px solid var(--line2);color:var(--dim);background:none}
.fb-row{padding:var(--s2) 0;border-bottom:1px solid var(--line);cursor:pointer}
.fb-row:last-child{border-bottom:none}
.fb-row small{color:var(--faint);display:block;font-size:var(--text-2xs)}
.fb-row p{margin:2px 0 0;color:var(--soft);font-size:var(--text-sm)}
.fb-empty{color:var(--faint);font-size:var(--text-sm)}
.fb-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:max(70px,calc(env(safe-area-inset-bottom,0px) + 66px));z-index:9999;background:var(--surface-solid);border:1px solid var(--up);color:var(--up);border-radius:999px;padding:8px 16px;font-size:var(--text-xs)}
.fb-toast.err{border-color:var(--down);color:var(--down)}
`;

function init() {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // --- nodes ---
  const toggle = Object.assign(document.createElement("button"), { id: "fb-toggle" });
  toggle.innerHTML = `feedback <b>…</b>`;
  document.body.appendChild(toggle);

  const sheet = Object.assign(document.createElement("dialog"), { id: "fb-sheet", className: "fb-sheet" });
  sheet.innerHTML = `
    <p class="label">annotate</p>
    <p class="fb-ctx"></p>
    <textarea placeholder="what and why — be blunt"></textarea>
    <div class="fb-actions">
      <button class="fb-btn fb-ghost" value="cancel">cancel</button>
      <button class="fb-btn fb-primary" value="ok">submit</button>
    </div>`;
  document.body.appendChild(sheet);

  const list = Object.assign(document.createElement("dialog"), { id: "fb-list", className: "fb-list" });
  list.innerHTML = `
    <p class="label">notes on this page</p>
    <div class="fb-rows"><p class="fb-empty">loading…</p></div>
    <div class="fb-actions"><button class="fb-btn fb-ghost" value="close">close</button></div>`;
  document.body.appendChild(list);

  let target = null;

  // --- annotate mode ---
  toggle.addEventListener("click", async () => {
    if (document.body.classList.contains("fb-mode")) {
      document.body.classList.remove("fb-mode");
      toggle.classList.remove("on");
      return;
    }
    const notes = await loadNotes();
    toast(notes.length ? `${notes.length} note(s) on this page · hold pill to read` : "tap anything to annotate");
    document.body.classList.add("fb-mode");
    toggle.classList.add("on");
  });

  document.addEventListener("pointerdown", (e) => {
    if (!document.body.classList.contains("fb-mode")) return;
    if (e.target.closest("#fb-toggle,#fb-sheet,#fb-list")) return;
    e.preventDefault(); e.stopPropagation();
    const el = e.target.closest("h1,h2,h3,p,a,button,img,svg,table,tr,li,.panel,.well,.capsule,label,input,textarea,section,header,footer,main > *,body > *") || e.target;
    if (!el || el === document.body || el === document.documentElement) return;
    target = el;
    document.body.classList.remove("fb-mode");
    toggle.classList.remove("on");

    const r = docRect(el);
    sheet.dataset.sel = sel(el);
    sheet.dataset.text = (el.textContent || "").trim().slice(0, 300);
    sheet.dataset.x = r.x; sheet.dataset.y = r.y; sheet.dataset.w = r.w; sheet.dataset.h = r.h;
    sheet.querySelector(".fb-ctx").textContent =
      "on: " + ((el.textContent || "").trim().slice(0, 90) || el.tagName.toLowerCase());

    const ta = sheet.querySelector("textarea");
    ta.value = sessionStorage.getItem("fb-draft:" + page) || "";
    el.classList.add("fb-hl");
    setTimeout(() => el.classList.remove("fb-hl"), 1200);
    if (!sheet.open) sheet.showModal();
    setTimeout(() => ta.focus(), 80);
  }, true);

  // draft survives accidental dismissal
  sheet.querySelector("textarea").addEventListener("input", (e) =>
    sessionStorage.setItem("fb-draft:" + page, e.target.value));

  sheet.addEventListener("click", async (e) => {
    const v = e.target.value;
    if (!v) return;
    if (v === "cancel") { sheet.close(); return; } // draft kept on purpose
    const ta = sheet.querySelector("textarea");
    const note = ta.value.trim();
    if (!note) { toast("blank won't submit", true); return; }
    const d = sheet.dataset;
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page, selector: d.sel || "", text: d.text || "", note,
          x: +d.x || 0, y: +d.y || 0, w: +d.w || 0, h: +d.h || 0,
          vw: innerWidth, vh: innerHeight,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      sessionStorage.removeItem("fb-draft:" + page);
      ta.value = "";
      sheet.close();
      toast("noted. it stays.");
      bump(1);
    } catch {
      toast("submit failed — text kept, try again", true);
    }
  });

  // --- read notes: hold the pill ---
  async function showList() {
    const notes = await loadNotes();
    const rows = list.querySelector(".fb-rows");
    rows.innerHTML = notes.length
      ? notes.map((n, i) =>
          `<div class="fb-row" data-i="${i}"><small>${escapeHtml((n.ts || "").replace("T", " ").slice(0, 16))} · ${escapeHtml((n.selector || "").slice(-44))}</small><p>${escapeHtml((n.note || "").slice(0, 160))}</p></div>`).join("")
      : `<p class="fb-empty">no notes on this page yet.</p>`;
    if (!list.open) list.showModal();
  }

  let lpTimer = null;
  toggle.addEventListener("pointerdown", () => { lpTimer = setTimeout(showList, 500); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
    toggle.addEventListener(ev, () => clearTimeout(lpTimer)));

  list.addEventListener("click", (e) => {
    if (e.target.value === "close") { list.close(); return; }
    const row = e.target.closest(".fb-row");
    if (!row) return;
    loadNotes().then(notes => {
      const n = notes[+row.dataset.i];
      if (!n) return;
      list.close();
      let el = null;
      try { el = document.querySelector(n.selector); } catch {}
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.classList.add("fb-flash");
        setTimeout(() => el.classList.remove("fb-flash"), 1700);
      } else {
        scrollTo({ top: Math.max(0, (n.y || 0) - innerHeight / 3), behavior: "smooth" });
        toast("element changed since — jumped near its old spot");
      }
    });
  });

  function bump(d) {
    const b = toggle.querySelector("b");
    b.textContent = String(Math.max(0, (parseInt(b.textContent) || 0) + d));
  }

  loadNotes().then(ns => (toggle.querySelector("b").textContent = ns.length || "0"));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
