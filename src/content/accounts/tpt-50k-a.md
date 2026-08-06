---
id: "tpt-50k-a"
firm: "TakeProfitTrader"
size: 50000
sizeLabel: "50k"
drawdownLimit: 2000
trailing: true
contract: "MNQ"
pointsValue: 2
riskPerTrade: 200
stage: "payout"
stages:
  - stage: "eval"
    from: "2026-08-05"
  - stage: "buffer"
    from: "2026-10-12"
  - stage: "payout"
    from: "2026-12-10"
    note: "first payout $600"
---
