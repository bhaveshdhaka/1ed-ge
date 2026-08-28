/* 1edge theme — auto follows prefers-color-scheme; manual override persists (localStorage "1edge-theme").
   Model: dark canon st/css/tokens.css + light overlay st/css/tokens-light.css linked twice:
   #ls-auto gated by media query, #ls-force disabled until a manual choice needs it.
   No-JS pages still follow the system theme.
   HISTORY: R3 wired buttons at head-parse time (before #theme-seg existed) — dead
   switcher. R4 moved wiring to DOMContentLoaded. R4b goes further: clicks are handled
   by ONE document-level delegated listener registered immediately at script execution —
   there is NO timing in which tapping a segment can do nothing, regardless of parse
   order, module timing, or bfcache restores. */
(function () {
    var KEY = "1edge-theme";
    var auto = document.getElementById("ls-auto");
    var force = document.getElementById("ls-force");
    var META_DARK = "#0b0d12", META_LIGHT = "#f4f5f8";

    function setMeta(t) {
        var m = document.querySelector('meta[name="theme-color"]');
        if (m) m.content = (t === "light") ? META_LIGHT : META_DARK;
    }
    function apply(t) {
        document.documentElement.setAttribute("data-theme", t);
        if (!auto || !force) return;
        if (t === "light")      { auto.media = "not all"; force.disabled = false; }
        else if (t === "dark")  { auto.media = "not all"; force.disabled = true; }
        else                    { auto.media = "(prefers-color-scheme: light)"; force.disabled = true; }
        setMeta(t);
    }
    function current() {
        try { return localStorage.getItem(KEY) || "auto"; } catch (e) { return "auto"; }
    }
    function set(t) {
        try { if (t === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch (e) {}
        apply(t); sync();
    }
    function sync() {
        var cur = current();
        var segs = document.querySelectorAll("#theme-seg [data-t]");
        for (var i = 0; i < segs.length; i++) {
            segs[i].setAttribute("aria-pressed", String(segs[i].getAttribute("data-t") === cur));
        }
    }
    window.__theme = { set: set, current: current };
    apply(current());
    /* delegation: lives on <document>, catches seg taps whenever they happen */
    document.addEventListener("click", function (e) {
        var t = e.target;
        while (t && t !== document) {
            if (t.getAttribute && t.getAttribute("data-t")) { set(t.getAttribute("data-t")); return; }
            t = t.parentNode;
        }
    }, false);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync);
    else sync();
})();
