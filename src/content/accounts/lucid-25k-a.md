---
id: "lucid-25k-a"
firm: "Lucid"
size: 25000
sizeLabel: "25k"
drawdownLimit: 1000
trailing: true
contract: "MNQ"
pointsValue: 2
riskPerTrade: 200
stage: "payout"
stages:
  - stage: "eval"
    from: "2026-08-05"
  - stage: "funded"
    from: "2026-11-05"
    note: "passed eval — half the drawdown limit in profit"
  - stage: "buffer"
    from: "2026-12-01"
    note: "buffer built"
  - stage: "payout"
    from: "2027-03-04"
    note: "payout eligible"
---
