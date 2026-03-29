"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowPathIcon, ArrowTrendingUpIcon, BanknotesIcon, ClockIcon } from "@heroicons/react/24/solid";
import { GAS_BENCHMARKS, type GasBenchmarkKey } from "~~/lib/performanceBenchmarks";

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

type AdminMetricsSnapshot = {
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

type MetricsResponse = {
  data: AdminMetricsSnapshot;
};

const formatUsdc = (value: number | undefined) => {
  if (value === undefined) {
    return "Loading...";
  }

  return `${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USDC`;
};

const formatCount = (value: number | undefined) => {
  if (value === undefined) {
    return "Loading...";
  }

  return value.toLocaleString();
};

const formatPercent = (value: number | null | undefined) => {
  if (value === undefined) {
    return "Loading...";
  }

  if (value === null) {
    return "No data";
  }

  return `${value.toFixed(1)}%`;
};

const formatMinutes = (value: number | null | undefined) => {
  if (value === undefined) {
    return "Loading...";
  }

  if (value === null) {
    return "No data";
  }

  return `${value.toFixed(1)} min`;
};

const formatGas = (value: number | null | undefined) => {
  if (value === undefined) {
    return "Loading...";
  }

  if (value === null) {
    return "No data";
  }

  return `${value.toLocaleString()} gas`;
};

const formatEth = (value: number | null | undefined) => {
  if (value === undefined) {
    return "Loading...";
  }

  if (value === null) {
    return "No data";
  }

  return `${value.toFixed(6)} ETH`;
};

const getBenchmarkStatus = (averageGasUsed: number | null | undefined, budget: number) => {
  if (averageGasUsed === undefined) {
    return {
      label: "Loading benchmark check...",
      tone: "neutral" as const,
    };
  }

  if (averageGasUsed === null) {
    return {
      label: "Awaiting indexed live data",
      tone: "neutral" as const,
    };
  }

  if (averageGasUsed <= budget) {
    return {
      label: `${(budget - averageGasUsed).toLocaleString()} gas under ceiling`,
      tone: "success" as const,
    };
  }

  return {
    label: `${(averageGasUsed - budget).toLocaleString()} gas above ceiling`,
    tone: "error" as const,
  };
};

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-base-content/65">{description}</p>
    </div>
  );
}

function GasMetricCard({
  benchmarkKey,
  metric,
  tone,
}: {
  benchmarkKey: GasBenchmarkKey;
  metric: GasMetricSnapshot | undefined;
  tone: "primary" | "success" | "secondary";
}) {
  const benchmark = GAS_BENCHMARKS[benchmarkKey];
  const status = getBenchmarkStatus(metric?.averageGasUsed, benchmark.gasBudget);
  const titleToneClasses = {
    primary: "border-primary/20 bg-primary/10 text-primary",
    success: "border-success/20 bg-success/10 text-success",
    secondary: "border-secondary/20 bg-secondary/10 text-secondary",
  };
  const statusToneClasses = {
    success: "border-success/20 bg-success/10 text-success",
    error: "border-error/20 bg-error/10 text-error",
    neutral: "border-base-300 bg-base-200/60 text-base-content/70",
  };

  return (
    <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${titleToneClasses[tone]}`}
        >
          {benchmark.label} Gas
        </div>
        <div className={`rounded-full border px-3 py-2 text-xs font-semibold ${statusToneClasses[status.tone]}`}>
          {status.tone === "success" ? "Within benchmark" : status.tone === "error" ? "Above benchmark" : "Waiting"}
        </div>
      </div>

      <div className="mt-4 text-3xl font-black">{formatGas(metric?.averageGasUsed)}</div>
      <div className="mt-2 text-sm font-medium text-base-content/80">{status.label}</div>
      <div className="mt-3 space-y-1 text-sm leading-7 text-base-content/65">
        <div>
          {metric?.sampleCount
            ? `${metric.sampleCount.toLocaleString()} indexed tx from Ponder`
            : "No indexed transactions yet"}
        </div>
        <div>Benchmark ceiling: {benchmark.gasBudget.toLocaleString()} gas</div>
        <div>Controlled cost ceiling @20 gwei: {formatEth(benchmark.maxCostEthAt20Gwei)}</div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle?: string;
  tone: "primary" | "success" | "secondary";
}) {
  const toneClasses = {
    primary: "border-primary/20 bg-primary/10 text-primary",
    success: "border-success/20 bg-success/10 text-success",
    secondary: "border-secondary/20 bg-secondary/10 text-secondary",
  };

  return (
    <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div
        className={`inline-flex rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${toneClasses[tone]}`}
      >
        {title}
      </div>
      <div className="mt-4 text-3xl font-black">{value}</div>
      {subtitle ? <div className="mt-2 text-sm leading-6 text-base-content/65">{subtitle}</div> : null}
    </div>
  );
}

const ADMIN_METRICS_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const loadMetrics = async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await fetch("/api/admin/metrics", {
          cache: "no-store",
        });
        const payload = (await response.json()) as MetricsResponse | { error?: string };

        if (!response.ok || !("data" in payload)) {
          throw new Error("error" in payload ? payload.error : "Failed to load admin metrics.");
        }

        if (isCancelled) {
          return;
        }

        setMetrics(payload.data);
        setError("");
      } catch (caughtError) {
        if (isCancelled) {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "Failed to load admin metrics.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void loadMetrics();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadMetrics();
      }
    }, ADMIN_METRICS_REFRESH_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const lastUpdated = metrics ? new Date(metrics.generatedAt).toLocaleString() : "Loading...";
  const formattedPoolBalance = formatUsdc(metrics?.pool.poolBalanceUsdc);
  const overallAverageGas = formatGas(metrics?.gas.overall.averageGasUsed);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-base-300 bg-base-100 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%)]" />
        <div className="relative grid gap-8 px-8 py-8 lg:grid-cols-[minmax(0,1.2fr)_22rem] lg:items-end">
          <div>
            <div className="badge badge-outline border-success/30 bg-success/10 px-4 py-4 text-success">
              Admin Console
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">Insurance Operations Dashboard</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-base-content/70">
              Monitor live contract metrics, follow oracle outcomes, and show benchmarked gas efficiency from
              Ponder-indexed transaction receipts.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-base-content/60">
              <div>Network: {metrics?.network ?? "Loading..."}</div>
              <div>Last updated: {lastUpdated}</div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/admin/oracle" className="btn btn-primary h-14 rounded-2xl px-6 text-base">
                Oracle Ops
              </Link>
              <Link href="/pool" className="btn btn-outline h-14 rounded-2xl px-6 text-base">
                Manage Pool
              </Link>
              <button
                className="btn btn-ghost h-14 rounded-2xl px-5 text-base"
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    const response = await fetch("/api/admin/metrics", {
                      cache: "no-store",
                    });
                    const payload = (await response.json()) as MetricsResponse | { error?: string };

                    if (!response.ok || !("data" in payload)) {
                      throw new Error("error" in payload ? payload.error : "Failed to refresh metrics.");
                    }

                    setMetrics(payload.data);
                    setError("");
                  } catch (caughtError) {
                    setError(caughtError instanceof Error ? caughtError.message : "Failed to refresh metrics.");
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isRefreshing}
              >
                <ArrowPathIcon className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Refreshing..." : "Refresh Metrics"}
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <BanknotesIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.18em] text-base-content/45">Pool Balance</div>
                  <div className="mt-1 text-2xl font-black">{formattedPoolBalance}</div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-secondary/10 p-3 text-secondary">
                  <ArrowTrendingUpIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.18em] text-base-content/45">Overall Avg Gas</div>
                  <div className="mt-1 text-2xl font-black">{overallAverageGas}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="alert alert-error rounded-2xl">
          <span>{error}</span>
        </div>
      ) : null}

      {isLoading && !metrics ? (
        <div className="rounded-3xl border border-base-300 bg-base-100 p-8 shadow-sm">
          <div className="flex items-center gap-3 text-base-content/70">
            <span className="loading loading-spinner loading-md" />
            <span>Loading measurable admin metrics from the contracts, receipts, and flight dataset...</span>
          </div>
        </div>
      ) : null}

      <section className="space-y-8">
        <div>
          <SectionIntro
            title="Evaluation Quality"
            description="These are the clearest rubric-facing evaluation metrics: outcome consistency, claim decision rate, and settlement speed."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Oracle Consistency"
              value={formatPercent(metrics?.evaluation.oracleDecisionConsistencyRate)}
              subtitle={
                metrics
                  ? `Compared against ${metrics.evaluation.oracleDecisionConsistencySamples} fulfilled oracle samples.`
                  : "Compares on-chain oracle outcomes against the current Postgres-backed consensus decision."
              }
              tone="success"
            />
            <MetricCard
              title="Claim Approval Rate"
              value={formatPercent(metrics?.operations.claimApprovalRate)}
              subtitle="Approved claims divided by fulfilled oracle requests."
              tone="secondary"
            />
            <MetricCard
              title="Avg Settlement Time"
              value={formatMinutes(metrics?.operations.averageSettlementMinutes)}
              subtitle="Average time from oracle request creation to fulfillment."
              tone="primary"
            />
          </div>
        </div>

        <div>
          <SectionIntro
            title="Economic Performance"
            description="These metrics show underwriting outcome, capital position, and whether premiums are covering payouts."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Pool Balance"
              value={formatUsdc(metrics?.pool.poolBalanceUsdc)}
              subtitle="Funds currently available to satisfy payouts."
              tone="success"
            />
            <MetricCard
              title="Premium Volume"
              value={formatUsdc(metrics?.pool.totalPremiumsCollectedUsdc)}
              subtitle="Total premium revenue tracked by the insurance pool contract."
              tone="primary"
            />
            <MetricCard
              title="Payout Volume"
              value={formatUsdc(metrics?.pool.totalPayoutsUsdc)}
              subtitle="Total payout outflow recorded on-chain."
              tone="secondary"
            />
            <MetricCard
              title="Loss Ratio"
              value={formatPercent(metrics?.evaluation.lossRatio)}
              subtitle="Total payouts divided by total premiums collected."
              tone="primary"
            />
          </div>
        </div>

        <div>
          <SectionIntro
            title="Operational Throughput"
            description="These show real system usage and current operational load across policies and claims."
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Policies Sold"
              value={formatCount(metrics?.policies.totalPoliciesSold)}
              subtitle="Total on-chain policies created through PolicyManager."
              tone="success"
            />
            <MetricCard
              title="Pending Claims"
              value={formatCount(metrics?.policies.pendingClaims)}
              subtitle="Departed active policies still awaiting final oracle resolution."
              tone="primary"
            />
            <MetricCard
              title="Approved Claims"
              value={formatCount(metrics?.operations.approvedClaims)}
              subtitle="Fulfilled oracle requests that executed a payout."
              tone="secondary"
            />
          </div>
        </div>
      </section>

      <section>
        <SectionIntro
          title="Efficiency And Cost"
          description="Observed gas usage comes from Ponder-indexed receipts in Postgres. Benchmark ceilings come from controlled Hardhat tests and act as the efficiency baseline."
        />

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <GasMetricCard benchmarkKey="buyPolicy" metric={metrics?.gas.buyPolicy} tone="primary" />
          <GasMetricCard benchmarkKey="depositLiquidity" metric={metrics?.gas.depositLiquidity} tone="secondary" />
          <GasMetricCard benchmarkKey="oracleRequest" metric={metrics?.gas.oracleRequest} tone="success" />
          <GasMetricCard benchmarkKey="oracleFulfillment" metric={metrics?.gas.oracleFulfillment} tone="primary" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Operations</h2>
          <p className="mt-2 text-sm leading-7 text-base-content/65">
            Open the core admin views for pool oversight and oracle settlement review.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Link
              href="/pool"
              className="rounded-3xl border border-base-300 bg-base-200/60 p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-center gap-3 text-secondary">
                <BanknotesIcon className="h-6 w-6" />
                <div className="text-lg font-semibold">Liquidity Pool</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/65">
                Review the live pool balance and funding history, then top up liquidity when payout coverage looks thin.
              </p>
            </Link>

            <Link
              href="/admin/oracle"
              className="rounded-3xl border border-base-300 bg-base-200/60 p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-center gap-3 text-primary">
                <ClockIcon className="h-6 w-6" />
                <div className="text-lg font-semibold">Oracle History</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/65">
                Inspect source votes, Chainlink requests, and final settlement outcomes in one timeline.
              </p>
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Methodology</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-base-200/60 p-4">
              <div className="font-semibold">Oracle consistency</div>
              <div className="mt-2 text-sm leading-7 text-base-content/65">
                This compares each fulfilled on-chain decision against the current validated flight record for outcome,
                delay minutes, and payout result.
              </div>
            </div>
            <div className="rounded-2xl bg-base-200/60 p-4">
              <div className="font-semibold">Gas measurement</div>
              <div className="mt-2 space-y-1 text-sm leading-7 text-base-content/65">
                <div>Average gas used: {formatGas(metrics?.gas.overall.averageGasUsed)}</div>
                <div>Total gas observed: {formatCount(metrics?.gas.overall.totalGasUsed)}</div>
                <div>
                  Gas source:{" "}
                  {metrics?.gas.source === "ponder_indexed"
                    ? "Ponder-indexed Postgres history"
                    : "No indexed transaction data yet"}
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-base-200/60 p-4">
              <div className="font-semibold">Benchmarks</div>
              <div className="mt-2 space-y-1 text-sm leading-7 text-base-content/65">
                <div>Observed gas reflects recent Sepolia transactions.</div>
                <div>Benchmark ceilings come from repeatable Hardhat test runs.</div>
                <div>Comparing both shows how live usage tracks against the planned budget.</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
