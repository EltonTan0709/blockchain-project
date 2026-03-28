import "server-only";
import { createPublicClient, formatUnits, http, parseUnits } from "viem";
import type { Address } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import { getOracleDecisionForPolicy } from "~~/lib/oracle";
import { prisma } from "~~/lib/prisma";
import scaffoldConfig from "~~/scaffold.config";
import { CONTRACTS } from "~~/utils/scaffold-eth/contract";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth/networks";

const TOKEN_DECIMALS = CONTRACTS.TOKEN_DECIMALS;
const FIXED_GAS_PRICE_20_GWEI = parseUnits("20", 9);
const GAS_METRICS_CACHE_TTL_MS = 2 * 60 * 1000;
const ADMIN_METRICS_CACHE_TTL_MS = 60 * 1000;
const PONDER_DATABASE_SCHEMA = process.env.PONDER_DATABASE_SCHEMA ?? "ponder";
const SAFE_SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const policyManagerAbi = [
  {
    type: "function",
    name: "nextPolicyId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "policyId", type: "uint256" },
          { name: "holder", type: "address" },
          { name: "flightNumber", type: "string" },
          { name: "purchaseTime", type: "uint256" },
          { name: "departureTimestamp", type: "uint256" },
          { name: "premium", type: "uint256" },
          { name: "coverageAmount", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "delayThresholdMinutes", type: "uint256" },
          { name: "policyType", type: "uint8" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
] as const;

const insurancePoolAbi = [
  {
    type: "function",
    name: "getPoolBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalLiquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalPremiumsCollected",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalPayouts",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const oracleCoordinatorAbi = [
  {
    type: "function",
    name: "requestsByPolicyId",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "requestId", type: "uint256" },
          { name: "policyId", type: "uint256" },
          { name: "requestedAt", type: "uint256" },
          { name: "fulfilledAt", type: "uint256" },
          { name: "pending", type: "bool" },
          { name: "fulfilled", type: "bool" },
          { name: "outcome", type: "uint8" },
          { name: "delayMinutes", type: "uint256" },
          { name: "payoutExecuted", type: "bool" },
          { name: "payoutAmount", type: "uint256" },
        ],
      },
    ],
  },
] as const;

type PolicySnapshot = {
  policyId: bigint;
  holder: Address;
  flightNumber: string;
  purchaseTime: bigint;
  departureTimestamp: bigint;
  premium: bigint;
  coverageAmount: bigint;
  endTime: bigint;
  delayThresholdMinutes: bigint;
  policyType: number;
  status: number;
};

type OracleRequestSnapshot = {
  requestId: bigint;
  policyId: bigint;
  requestedAt: bigint;
  fulfilledAt: bigint;
  pending: boolean;
  fulfilled: boolean;
  outcome: number;
  delayMinutes: bigint;
  payoutExecuted: boolean;
  payoutAmount: bigint;
};

type GasMetricSnapshot = {
  sampleCount: number;
  averageGasUsed: number | null;
  minGasUsed: number | null;
  maxGasUsed: number | null;
  totalGasUsed: number;
  averageGasPriceGwei: number | null;
  averageTransactionFeeEth: number | null;
  estimatedFeeAt20GweiEth: number | null;
};

type PonderGasAggregateRow = {
  sampleCount: number;
  averageGasUsed: number | null;
  minGasUsed: number | null;
  maxGasUsed: number | null;
  totalGasUsed: number | null;
  averageGasPriceGwei: number | null;
  averageTransactionFeeEth: number | null;
  startBlock: string | null;
  endBlock: string | null;
};

type PonderGasActionRow = Omit<PonderGasAggregateRow, "startBlock" | "endBlock"> & {
  actionType: "buyPolicy" | "depositLiquidity" | "oracleRequest" | "oracleFulfillment";
};

export type AdminMetricsSnapshot = {
  generatedAt: string;
  network: string;
  pool: {
    poolBalanceUsdc: number;
    totalLiquidityUsdc: number;
    totalPremiumsCollectedUsdc: number;
    totalPayoutsUsdc: number;
    netUnderwritingUsdc: number;
  };
  policies: {
    totalPoliciesSold: number;
    activePolicies: number;
    expiredPolicies: number;
    paidOutPolicies: number;
    pendingClaims: number;
    averagePremiumUsdc: number;
    averageCoverageUsdc: number;
  };
  operations: {
    pendingOracleRequests: number;
    fulfilledOracleRequests: number;
    approvedClaims: number;
    claimApprovalRate: number | null;
    averageSettlementMinutes: number | null;
  };
  evaluation: {
    lossRatio: number | null;
    oracleDecisionConsistencyRate: number | null;
    oracleDecisionConsistencySamples: number;
  };
  gas: {
    source: "ponder_indexed" | "none";
    sampleWindowBlocks: number;
    sampleWindowStartBlock: string | null;
    sampleWindowEndBlock: string | null;
    overall: GasMetricSnapshot;
    buyPolicy: GasMetricSnapshot;
    depositLiquidity: GasMetricSnapshot;
    oracleRequest: GasMetricSnapshot;
    oracleFulfillment: GasMetricSnapshot;
  };
};

let gasMetricsCache:
  | {
      expiresAt: number;
      metrics: AdminMetricsSnapshot["gas"];
    }
  | undefined;
let adminMetricsCache:
  | {
      expiresAt: number;
      metrics: AdminMetricsSnapshot;
    }
  | undefined;

const roundMetric = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const toUsdcNumber = (value: bigint) => {
  return roundMetric(Number(formatUnits(value, TOKEN_DECIMALS)));
};

const toEthNumber = (value: bigint, digits = 8) => {
  return roundMetric(Number(formatUnits(value, 18)), digits);
};

const average = (values: number[]) => {
  if (values.length === 0) {
    return null;
  }

  return roundMetric(values.reduce((sum, current) => sum + current, 0) / values.length);
};

const percentage = (numerator: number, denominator: number) => {
  if (denominator === 0) {
    return null;
  }

  return roundMetric((numerator / denominator) * 100, 1);
};

const emptyGasMetric = (): GasMetricSnapshot => ({
  sampleCount: 0,
  averageGasUsed: null,
  minGasUsed: null,
  maxGasUsed: null,
  totalGasUsed: 0,
  averageGasPriceGwei: null,
  averageTransactionFeeEth: null,
  estimatedFeeAt20GweiEth: null,
});

const toRoundedWholeNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  return Math.round(value);
};

const emptyGasMetricsSnapshot = (
  source: AdminMetricsSnapshot["gas"]["source"],
  sampleWindowStartBlock: bigint | null,
  sampleWindowEndBlock: bigint | null,
  sampleWindowBlocks: bigint,
): AdminMetricsSnapshot["gas"] => ({
  source,
  sampleWindowBlocks: Number(sampleWindowBlocks),
  sampleWindowStartBlock: sampleWindowStartBlock?.toString() ?? null,
  sampleWindowEndBlock: sampleWindowEndBlock?.toString() ?? null,
  overall: emptyGasMetric(),
  buyPolicy: emptyGasMetric(),
  depositLiquidity: emptyGasMetric(),
  oracleRequest: emptyGasMetric(),
  oracleFulfillment: emptyGasMetric(),
});

const getPonderGasTablePath = () => {
  if (!SAFE_SQL_IDENTIFIER_PATTERN.test(PONDER_DATABASE_SCHEMA)) {
    throw new Error(`Invalid Ponder schema name: ${PONDER_DATABASE_SCHEMA}`);
  }

  return `"${PONDER_DATABASE_SCHEMA}"."gas_transactions"`;
};

const summarizePonderAggregate = (
  row: PonderGasAggregateRow | PonderGasActionRow | null | undefined,
): GasMetricSnapshot => {
  const sampleCount = Number(row?.sampleCount ?? 0);

  if (!row || sampleCount === 0) {
    return emptyGasMetric();
  }

  const averageGasUsed = toRoundedWholeNumber(row.averageGasUsed);

  return {
    sampleCount,
    averageGasUsed,
    minGasUsed: toRoundedWholeNumber(row.minGasUsed),
    maxGasUsed: toRoundedWholeNumber(row.maxGasUsed),
    totalGasUsed: Math.round(Number(row.totalGasUsed ?? 0)),
    averageGasPriceGwei: row.averageGasPriceGwei === null ? null : roundMetric(row.averageGasPriceGwei, 2),
    averageTransactionFeeEth:
      row.averageTransactionFeeEth === null ? null : roundMetric(row.averageTransactionFeeEth, 8),
    estimatedFeeAt20GweiEth:
      averageGasUsed === null ? null : toEthNumber(BigInt(averageGasUsed) * FIXED_GAS_PRICE_20_GWEI),
  };
};

const targetNetwork = scaffoldConfig.targetNetworks[0];
const rpcOverrides = scaffoldConfig.rpcOverrides as Record<number, string> | undefined;
const fallbackRpcUrl =
  rpcOverrides?.[targetNetwork.id] ?? getAlchemyHttpUrl(targetNetwork.id) ?? targetNetwork.rpcUrls.default.http[0];

const publicClient = createPublicClient({
  chain: targetNetwork,
  transport: http(fallbackRpcUrl),
});

const configuredContracts = (
  deployedContracts as Record<
    number,
    {
      InsurancePool?: { address: string; deployedOnBlock?: number };
      OracleCoordinator?: { address: string; deployedOnBlock?: number };
      PolicyManager?: { address: string; deployedOnBlock?: number };
    }
  >
)[targetNetwork.id];

const policyManagerAddress = (configuredContracts?.PolicyManager?.address ?? CONTRACTS.PolicyManager) as Address;
const insurancePoolAddress = (configuredContracts?.InsurancePool?.address ?? CONTRACTS.InsurancePool) as Address;
const oracleCoordinatorAddress = configuredContracts?.OracleCoordinator?.address as Address | undefined;

const getPolicyIds = (policyCount: number) => {
  return Array.from({ length: policyCount }, (_, index) => BigInt(index + 1));
};

const getOracleConsistencyMetrics = async (fulfilledRequests: OracleRequestSnapshot[]) => {
  if (fulfilledRequests.length === 0) {
    return {
      matches: 0,
      samples: 0,
    };
  }

  const evaluatedRequests = await Promise.all(
    fulfilledRequests.map(async request => {
      try {
        const decision = await getOracleDecisionForPolicy(request.policyId);

        const outcomeMatches = request.outcome === decision.oracle.outcome;
        const delayMatches = Number(request.delayMinutes) === decision.oracle.delayMinutes;
        const payoutMatches = request.payoutExecuted === decision.oracle.payoutEligible;

        return outcomeMatches && delayMatches && payoutMatches;
      } catch {
        return null;
      }
    }),
  );

  const comparableResults = evaluatedRequests.filter((result): result is boolean => result !== null);

  return {
    matches: comparableResults.filter(Boolean).length,
    samples: comparableResults.length,
  };
};

const getBlockSpan = (startBlock: bigint, endBlock: bigint) => {
  if (endBlock < startBlock) {
    return 0n;
  }

  return endBlock - startBlock + 1n;
};

const getGasMetrics = async (): Promise<AdminMetricsSnapshot["gas"]> => {
  if (gasMetricsCache && Date.now() < gasMetricsCache.expiresAt) {
    return gasMetricsCache.metrics;
  }

  try {
    const gasTablePath = getPonderGasTablePath();
    const [overallGasMetrics] = await prisma.$queryRawUnsafe<PonderGasAggregateRow[]>(`
      SELECT
        COUNT(*)::int AS "sampleCount",
        AVG("gas_used")::double precision AS "averageGasUsed",
        MIN("gas_used")::double precision AS "minGasUsed",
        MAX("gas_used")::double precision AS "maxGasUsed",
        COALESCE(SUM("gas_used"), 0)::double precision AS "totalGasUsed",
        AVG("effective_gas_price")::double precision / 1000000000 AS "averageGasPriceGwei",
        AVG("fee_wei")::double precision / 1000000000000000000 AS "averageTransactionFeeEth",
        MIN("block_number")::text AS "startBlock",
        MAX("block_number")::text AS "endBlock"
      FROM ${gasTablePath}
    `);

    if (!overallGasMetrics || overallGasMetrics.sampleCount === 0) {
      const noDataMetrics = emptyGasMetricsSnapshot("none", null, null, 0n);

      gasMetricsCache = {
        expiresAt: Date.now() + GAS_METRICS_CACHE_TTL_MS,
        metrics: noDataMetrics,
      };

      return noDataMetrics;
    }

    const actionMetrics = await prisma.$queryRawUnsafe<PonderGasActionRow[]>(`
      SELECT
        "action_type" AS "actionType",
        COUNT(*)::int AS "sampleCount",
        AVG("gas_used")::double precision AS "averageGasUsed",
        MIN("gas_used")::double precision AS "minGasUsed",
        MAX("gas_used")::double precision AS "maxGasUsed",
        COALESCE(SUM("gas_used"), 0)::double precision AS "totalGasUsed",
        AVG("effective_gas_price")::double precision / 1000000000 AS "averageGasPriceGwei",
        AVG("fee_wei")::double precision / 1000000000000000000 AS "averageTransactionFeeEth",
        NULL::text AS "startBlock",
        NULL::text AS "endBlock"
      FROM ${gasTablePath}
      GROUP BY "action_type"
    `);

    const actionMetricsByType = new Map(actionMetrics.map(row => [row.actionType, row]));
    const indexedStartBlock = overallGasMetrics.startBlock ? BigInt(overallGasMetrics.startBlock) : null;
    const indexedEndBlock = overallGasMetrics.endBlock ? BigInt(overallGasMetrics.endBlock) : null;
    const ponderMetrics: AdminMetricsSnapshot["gas"] = {
      source: "ponder_indexed",
      sampleWindowBlocks:
        indexedStartBlock !== null && indexedEndBlock !== null
          ? Number(getBlockSpan(indexedStartBlock, indexedEndBlock))
          : 0,
      sampleWindowStartBlock: overallGasMetrics.startBlock,
      sampleWindowEndBlock: overallGasMetrics.endBlock,
      overall: summarizePonderAggregate(overallGasMetrics),
      buyPolicy: summarizePonderAggregate(actionMetricsByType.get("buyPolicy")),
      depositLiquidity: summarizePonderAggregate(actionMetricsByType.get("depositLiquidity")),
      oracleRequest: summarizePonderAggregate(actionMetricsByType.get("oracleRequest")),
      oracleFulfillment: summarizePonderAggregate(actionMetricsByType.get("oracleFulfillment")),
    };

    gasMetricsCache = {
      expiresAt: Date.now() + GAS_METRICS_CACHE_TTL_MS,
      metrics: ponderMetrics,
    };

    return ponderMetrics;
  } catch {
    const fallbackMetrics = emptyGasMetricsSnapshot("none", null, null, 0n);

    gasMetricsCache = {
      expiresAt: Date.now() + GAS_METRICS_CACHE_TTL_MS,
      metrics: fallbackMetrics,
    };

    return fallbackMetrics;
  }
};

export const getAdminMetrics = async (): Promise<AdminMetricsSnapshot> => {
  if (adminMetricsCache && Date.now() < adminMetricsCache.expiresAt) {
    return adminMetricsCache.metrics;
  }

  const [
    nextPolicyIdResult,
    poolBalanceResult,
    totalLiquidityResult,
    totalPremiumsCollectedResult,
    totalPayoutsResult,
    gasMetrics,
  ] = await Promise.all([
    publicClient
      .multicall({
        allowFailure: false,
        contracts: [
          {
            address: policyManagerAddress,
            abi: policyManagerAbi,
            functionName: "nextPolicyId",
          },
          {
            address: insurancePoolAddress,
            abi: insurancePoolAbi,
            functionName: "getPoolBalance",
          },
          {
            address: insurancePoolAddress,
            abi: insurancePoolAbi,
            functionName: "totalLiquidity",
          },
          {
            address: insurancePoolAddress,
            abi: insurancePoolAbi,
            functionName: "totalPremiumsCollected",
          },
          {
            address: insurancePoolAddress,
            abi: insurancePoolAbi,
            functionName: "totalPayouts",
          },
        ],
      })
      .then(
        ([nextPolicyId, poolBalance, totalLiquidity, totalPremiumsCollected, totalPayouts]) =>
          [nextPolicyId, poolBalance, totalLiquidity, totalPremiumsCollected, totalPayouts] as const,
      ),
    getGasMetrics(),
  ]).then(
    ([[nextPolicyId, poolBalance, totalLiquidity, totalPremiumsCollected, totalPayouts], gas]) =>
      [nextPolicyId, poolBalance, totalLiquidity, totalPremiumsCollected, totalPayouts, gas] as const,
  );

  const totalPoliciesSold = Number(nextPolicyIdResult - 1n);
  const policyIds = getPolicyIds(totalPoliciesSold);

  const [policies, oracleRequests] = await Promise.all([
    policyIds.length === 0
      ? Promise.resolve<PolicySnapshot[]>([])
      : publicClient
          .multicall({
            allowFailure: false,
            contracts: policyIds.map(policyId => ({
              address: policyManagerAddress,
              abi: policyManagerAbi,
              functionName: "getPolicy",
              args: [policyId],
            })),
          })
          .then(results => results as unknown as PolicySnapshot[]),
    !oracleCoordinatorAddress || policyIds.length === 0
      ? Promise.resolve<OracleRequestSnapshot[]>([])
      : publicClient
          .multicall({
            allowFailure: false,
            contracts: policyIds.map(policyId => ({
              address: oracleCoordinatorAddress,
              abi: oracleCoordinatorAbi,
              functionName: "requestsByPolicyId",
              args: [policyId],
            })),
          })
          .then(results => results as unknown as OracleRequestSnapshot[]),
  ]);

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const activePolicies = policies.filter(policy => policy.status === 0).length;
  const expiredPolicies = policies.filter(policy => policy.status === 1).length;
  const paidOutPolicies = policies.filter(policy => policy.status === 3).length;
  const pendingClaims = policies.filter(
    policy => policy.status === 0 && Number(policy.departureTimestamp) <= nowInSeconds,
  ).length;

  const pendingOracleRequests = oracleRequests.filter(request => request.pending && !request.fulfilled).length;
  const fulfilledOracleRequests = oracleRequests.filter(request => request.fulfilled).length;
  const approvedClaims = oracleRequests.filter(request => request.payoutExecuted).length;

  const settlementTimesInMinutes = oracleRequests
    .filter(request => request.fulfilled && request.fulfilledAt > request.requestedAt)
    .map(request => Number(request.fulfilledAt - request.requestedAt) / 60);

  const fulfilledRequests = oracleRequests.filter(request => request.fulfilled);
  const oracleConsistency = await getOracleConsistencyMetrics(fulfilledRequests);

  const totalPremiumVolumeFromPolicies = policies.reduce((sum, policy) => sum + policy.premium, 0n);
  const totalCoverageVolume = policies.reduce((sum, policy) => sum + policy.coverageAmount, 0n);
  const metrics: AdminMetricsSnapshot = {
    generatedAt: new Date().toISOString(),
    network: targetNetwork.name,
    pool: {
      poolBalanceUsdc: toUsdcNumber(poolBalanceResult),
      totalLiquidityUsdc: toUsdcNumber(totalLiquidityResult),
      totalPremiumsCollectedUsdc: toUsdcNumber(totalPremiumsCollectedResult),
      totalPayoutsUsdc: toUsdcNumber(totalPayoutsResult),
      netUnderwritingUsdc: toUsdcNumber(totalPremiumsCollectedResult - totalPayoutsResult),
    },
    policies: {
      totalPoliciesSold,
      activePolicies,
      expiredPolicies,
      paidOutPolicies,
      pendingClaims,
      averagePremiumUsdc:
        totalPoliciesSold === 0 ? 0 : roundMetric(toUsdcNumber(totalPremiumVolumeFromPolicies) / totalPoliciesSold),
      averageCoverageUsdc:
        totalPoliciesSold === 0 ? 0 : roundMetric(toUsdcNumber(totalCoverageVolume) / totalPoliciesSold),
    },
    operations: {
      pendingOracleRequests,
      fulfilledOracleRequests,
      approvedClaims,
      claimApprovalRate: percentage(approvedClaims, fulfilledOracleRequests),
      averageSettlementMinutes: average(settlementTimesInMinutes),
    },
    evaluation: {
      lossRatio: percentage(Number(totalPayoutsResult), Number(totalPremiumsCollectedResult)),
      oracleDecisionConsistencyRate: percentage(oracleConsistency.matches, oracleConsistency.samples),
      oracleDecisionConsistencySamples: oracleConsistency.samples,
    },
    gas: gasMetrics,
  };

  adminMetricsCache = {
    expiresAt: Date.now() + ADMIN_METRICS_CACHE_TTL_MS,
    metrics,
  };

  return metrics;
};
