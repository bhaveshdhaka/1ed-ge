---
id: "tpt-25k-b"
firm: "TakeProfitTrader"
size: 25000
sizeLabel: "25k"
drawdownLimit: 1000
trailing: true
contract: "MNQ"
pointsValue: 2
riskPerTrade: 200
stage: "eval"
stages:
  - stage: "eval"
    from: "2026-12-06"
rules:
  profitTarget: 1250
  consistencyPct: 40
  bufferBalance: 26100
  drawdownMode: intraday-to-eod
  payoutSplit: 90
---
