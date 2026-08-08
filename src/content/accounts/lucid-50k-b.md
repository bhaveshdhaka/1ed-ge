---
id: "lucid-50k-b"
firm: "Lucid"
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
    from: "2027-03-01"
rules:
  dailyLoss: 300
  breach: 'drawdown'
  consistency: 'eval'
  consistencyNote: "30% rule — applies during the eval stage only"
---
