---
id: lucid-25k-a
firm: Lucid
size: 25000
sizeLabel: 25k
drawdownLimit: 1000
trailing: true
contract: MNQ
pointsValue: 2
riskPerTrade: 200
stage: failed
stages:
  - stage: eval
    from: '2024-08-09'
  - stage: funded
    from: '2025-08-09'
  - stage: failed
    from: '2025-10-01'
note: breached the 1000 drawdown on 2025-10-01 — account closed.
rules:
  profitTarget: 1250
  consistencyPct: 40
  bufferBalance: 26100
  drawdownMode: eod
  payoutSplit: 90
---

