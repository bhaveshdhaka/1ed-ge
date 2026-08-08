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
stage: "eval"
stages:
  - stage: "eval"
    from: "2026-08-05"
rules:
  dailyLoss: 200
  breach: 'daily'
  consistency: 'both'
  consistencyNote: "no single day above 25% of total profit — throughout"
---
