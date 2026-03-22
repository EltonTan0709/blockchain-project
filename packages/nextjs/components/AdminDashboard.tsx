"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
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

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="text-sm text-base-content/70">{title}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {subtitle ? <div className="mt-1 text-sm text-base-content/60">{subtitle}</div> : null}
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
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Insurance Admin Dashboard</h1>
        <p className="mt-2 text-base-content/70">Overview of the insurance pool, contracts, and claim workflow.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Pool Balance" value={formattedPoolBalance} subtitle="Real on-chain balance" />
        <StatCard
          title="Total Liquidity Deposited"
          value={formattedTotalLiquidity}
          subtitle="Real on-chain accounting value"
        />
        <StatCard title="Policies Sold" value="12" subtitle="Mock data for now" />
        <StatCard title="Pending Claims" value="3" subtitle="Mock data for now" />
        <StatCard title="Approved Claims" value="8" subtitle="Mock data for now" />
        <StatCard title="Total Payout Volume" value="4,500 USDC" subtitle="Mock data for now" />
      </div>

      <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">Quick Actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/pool" className="btn btn-primary">
            Deposit Liquidity
          </Link>
          <Link href="/admin/flights" className="btn btn-secondary">
            Manage Flights
          </Link>
          <button className="btn btn-outline" disabled>
            View Policies
          </button>
          <button className="btn btn-outline" disabled>
            Review Claims
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">System Notes</h2>
        <ul className="mt-4 list-disc pl-5 space-y-2 text-base-content/75">
          <li>Pool Balance and Total Liquidity are live contract reads.</li>
          <li>Policy and claim metrics are mocked temporarily.</li>
          <li>Next integration step is policy purchase, then claim submission and payout flow.</li>
        </ul>
      </div>
    </div>
  );
}
