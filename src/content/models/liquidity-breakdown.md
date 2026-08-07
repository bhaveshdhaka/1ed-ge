---
name: "liquidity-breakdown"
premise: "Stops cluster under obvious lows; the sweep prints liquidity, then price breaks and runs."
status: "active"
order: 4
rules:
  - "only after a failed retest of the swept level"
  - "no shorting into support without the sweep first"
  - "cover into the next pool, not all at once"
  - "risk the fixed $ amount, never scale into size when angry"
---
