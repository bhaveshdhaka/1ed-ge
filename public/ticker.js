/**
 * ticker.js — shared 1-second interval for all market countdown components.
 * Loaded once per page; MarketLive, MarketFooter, MarketWidget all register here.
 * Pauses when the tab is hidden (document.hidden) to save battery on iOS PWA.
 */
;(function () {
  'use strict'
  var listeners = []
  var running = false

  function onTick(fn) {
    listeners.push(fn)
    if (!running) {
      running = true
      setInterval(function () {
        if (document.hidden) return
        for (var i = 0; i < listeners.length; i++) listeners[i]()
      }, 1000)
    }
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n }

  function fmtHuman(sec) {
    sec = Math.max(0, Math.round(sec))
    var d = Math.floor(sec / 86400)
    var h = Math.floor((sec % 86400) / 3600)
    var m = Math.floor((sec % 3600) / 60)
    var s = Math.floor(sec % 60)
    if (d > 0) return h > 0 ? d + 'd ' + h + 'h' : d + 'd'
    if (h > 0) return m > 0 ? h + 'h ' + m + 'm' : h + 'h'
    if (m >= 15) return m + 'm'
    return pad2(m) + ':' + pad2(s)
  }

  function segAt(segs, now) {
    for (var i = 0; i < segs.length; i++) if (now >= segs[i].at && now < segs[i].until) return segs[i]
    return null
  }

  function nextAt(list, now) {
    var up = []
    for (var i = 0; i < list.length; i++) if (list[i].at > now) up.push(list[i])
    if (!up.length) return null
    for (var j = 0; j < up.length; j++) if (up[j].kind === 'red') return up[j]
    var best = up[0]
    for (var k = 1; k < up.length; k++) if (up[k].at < best.at) best = up[k]
    return best
  }

  // Soonest upcoming red and soonest upcoming orange, independently.
  function nextLines(list, now) {
    var up = []
    for (var i = 0; i < list.length; i++) if (list[i].at > now) up.push(list[i])
    var soonest = function (kind) {
      var best = null
      for (var j = 0; j < up.length; j++) {
        if (up[j].kind !== kind) continue
        if (best === null || up[j].at < best.at) best = up[j]
      }
      return best
    }
    return { red: soonest('red'), orange: soonest('orange') }
  }

  function color(cls) {
    return cls === 'up' ? 'var(--color-up)' : cls === 'warn' ? 'var(--color-warn)' : cls === 'down' ? 'var(--color-down)' : 'var(--color-dim)'
  }

  function clsName(cls) {
    return cls === 'up' ? 'text-up' : cls === 'warn' ? 'text-warn' : cls === 'down' ? 'text-down' : 'text-dim'
  }

  function glyph(cls) { return cls === 'up' ? '●' : cls === 'warn' ? '◐' : '✕' }

  window.__ticker = {
    onTick: onTick,
    fmtHuman: fmtHuman,
    segAt: segAt,
    nextAt: nextAt,
    nextLines: nextLines,
    color: color,
    clsName: clsName,
    glyph: glyph,
    pad2: pad2
  }
})()
