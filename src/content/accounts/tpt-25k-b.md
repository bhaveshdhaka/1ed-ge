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
stage: "payout"
stages:
  - stage: "eval"
    from: "2026-12-06"
  - stage: "funded"
    from: "2027-08-27"
    note: "passed eval — half the drawdown limit in profit"
  - stage: "buffer"
    from: "2028-01-20"
    note: "buffer built"
  - stage: "payout"
    from: "2028-07-20"
    note: "payout eligible"
---
