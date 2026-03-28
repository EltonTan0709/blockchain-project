"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
import {
  ArrowTrendingUpIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/solid";
import { CONTRACTS } from "~~/utils/scaffold-eth/contract";

const INSURANCE_POOL_ADDRESS = CONTRACTS.InsurancePool;
const TOKEN_DECIMALS = CONTRACTS.TOKEN_DECIMALS;

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
] as const;

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

export default function AdminDashboard() {
  const { data: poolBalance, isLoading: poolBalanceLoading } = useReadContract({
    abi: insurancePoolAbi,
    address: INSURANCE_POOL_ADDRESS,
    functionName: "getPoolBalance",
  });

  const { data: totalLiquidity, isLoading: totalLiquidityLoading } = useReadContract({
    abi: insurancePoolAbi,
    address: INSURANCE_POOL_ADDRESS,
    functionName: "totalLiquidity",
  });

  const formattedPoolBalance =
    poolBalanceLoading || poolBalance === undefined ? "Loading..." : `${formatUnits(poolBalance, TOKEN_DECIMALS)} USDC`;

  const formattedTotalLiquidity =
    totalLiquidityLoading || totalLiquidity === undefined
      ? "Loading..."
      : `${formatUnits(totalLiquidity, TOKEN_DECIMALS)} USDC`;

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
              Monitor the pool, review operational health, and jump into the admin workflows that power the demo.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/admin/flights" className="btn btn-primary h-14 rounded-2xl px-6 text-base">
                Manage Flights
              </Link>
              <Link href="/admin/oracle" className="btn btn-outline btn-primary h-14 rounded-2xl px-6 text-base">
                Oracle Ops
              </Link>
              <Link href="/pool" className="btn btn-outline h-14 rounded-2xl px-6 text-base">
                Manage Pool
              </Link>
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
                  <div className="text-sm uppercase tracking-[0.18em] text-base-content/45">Total Liquidity</div>
                  <div className="mt-1 text-2xl font-black">{formattedTotalLiquidity}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Pool Balance"
          value={formattedPoolBalance}
          subtitle="Live contract balance available in the pool."
          tone="primary"
        />
        <MetricCard
          title="Total Liquidity"
          value={formattedTotalLiquidity}
          subtitle="Live accounting value from the insurance pool contract."
          tone="secondary"
        />
        <MetricCard
          title="Policies Sold"
          value="12"
          subtitle="Demo metric until policy analytics are wired in."
          tone="success"
        />
        <MetricCard
          title="Pending Claims"
          value="3"
          subtitle="Demo placeholder for upcoming claim review tooling."
          tone="primary"
        />
        <MetricCard
          title="Approved Claims"
          value="8"
          subtitle="Demo placeholder for payout processing stats."
          tone="success"
        />
        <MetricCard
          title="Total Payout Volume"
          value="4,500 USDC"
          subtitle="Demo figure for operational reporting."
          tone="secondary"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Quick Actions</h2>
          <p className="mt-2 text-sm leading-7 text-base-content/65">
            Jump straight into the most important operational tasks for the MVP.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Link
              href="/admin/flights"
              className="rounded-3xl border border-base-300 bg-base-200/60 p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-center gap-3 text-primary">
                <ShieldCheckIcon className="h-6 w-6" />
                <div className="text-lg font-semibold">Flight Operations</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/65">
                Update statuses, review history, and drive the insurance trigger flow.
              </p>
            </Link>

            <Link
              href="/pool"
              className="rounded-3xl border border-base-300 bg-base-200/60 p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-center gap-3 text-secondary">
                <BanknotesIcon className="h-6 w-6" />
                <div className="text-lg font-semibold">Liquidity Pool</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/65">
                Review pool funding and manage the capital available for payouts.
              </p>
            </Link>

            <Link
              href="/admin/oracle"
              className="rounded-3xl border border-base-300 bg-base-200/60 p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-center gap-3 text-primary">
                <ClockIcon className="h-6 w-6" />
                <div className="text-lg font-semibold">Oracle Automation</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/65">
                Run Postgres-backed oracle checks and preview the payout decision before fulfillment.
              </p>
            </Link>

            <div className="rounded-3xl border border-base-300 bg-base-200/40 p-5 opacity-80">
              <div className="flex items-center gap-3 text-base-content/60">
                <CheckBadgeIcon className="h-6 w-6" />
                <div className="text-lg font-semibold">Claims Review</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/60">
                Reserved for the upcoming claims workflow once end-to-end settlement is integrated.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
          <h2 className="text-2xl font-bold">System Notes</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-base-200/60 p-4">
              <div className="font-semibold">Live reads</div>
              <div className="mt-2 text-sm leading-7 text-base-content/65">
                Pool Balance and Total Liquidity are pulled live from the deployed insurance pool contract.
              </div>
            </div>
            <div className="rounded-2xl bg-base-200/60 p-4">
              <div className="font-semibold">Demo metrics</div>
              <div className="mt-2 text-sm leading-7 text-base-content/65">
                Policy and claim counts are still mocked until policy analytics and claims flows are connected.
              </div>
            </div>
            <div className="rounded-2xl bg-base-200/60 p-4">
              <div className="font-semibold">Next milestone</div>
              <div className="mt-2 text-sm leading-7 text-base-content/65">
                Finalize purchase-to-claim automation so operational stats become fully on-chain and real-time.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
