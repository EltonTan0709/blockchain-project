export const GAS_BENCHMARKS = {
  buyPolicy: {
    label: "Buy Policy",
    gasBudget: 370_000,
    maxCostEthAt20Gwei: 0.0075,
  },
  depositLiquidity: {
    label: "Deposit Liquidity",
    gasBudget: 110_000,
    maxCostEthAt20Gwei: 0.0023,
  },
  oracleRequest: {
    label: "Oracle Request",
    gasBudget: 170_000,
    maxCostEthAt20Gwei: 0.0035,
  },
  oracleFulfillment: {
    label: "Oracle Fulfillment",
    gasBudget: 245_000,
    maxCostEthAt20Gwei: 0.005,
  },
} as const;

export type GasBenchmarkKey = keyof typeof GAS_BENCHMARKS;
