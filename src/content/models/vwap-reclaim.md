---
name: "vwap-reclaim"
premise: "Price that reclaims VWAP after being rejected tends to hold it — the session's fair-value magnet flips."
status: "active"
order: 3
rules:
  - "confirmation candle required — no instant fills at the line"
  - "target is the next session high/low, not a guess"
  - "if price loses the reclaim level, exit and stay out"
  - "risk the fixed $ amount, take the full plan or nothing"
---
