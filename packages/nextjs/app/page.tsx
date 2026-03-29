"use client";

import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatUnits } from "viem";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import {
  ArrowRightIcon,
  ClipboardDocumentListIcon,
  GlobeAltIcon,
  MagnifyingGlassCircleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/solid";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useAdminWallet } from "~~/hooks/scaffold-eth/useAdminWallet";

const TOKEN_DECIMALS = 6;

const formatUsdcBalance = (value: bigint | undefined) => {
  if (value === undefined) {
    return "Loading...";
  }

  const numericValue = Number(formatUnits(value, TOKEN_DECIMALS));

  return `${numericValue.toLocaleString(undefined, {
    minimumFractionDigits: numericValue >= 100 ? 0 : 2,
    maximumFractionDigits: 2,
  })} USDC`;
};

function UserMetricCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
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
      <div className="mt-2 text-sm leading-6 text-base-content/65">{subtitle}</div>
    </div>
  );
}

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { isAdmin, isConnected } = useAdminWallet();
  const { targetNetwork } = useTargetNetwork();
  const { data: walletUsdcBalance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "balanceOf",
    args: [connectedAddress],
    query: {
      enabled: !!connectedAddress,
    },
  });

  if (isAdmin) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-8 shadow-2xl">
          <div className="badge badge-outline border-success/30 bg-success/10 px-4 py-4 text-success">
            Admin Shortcut
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">Admin wallet detected</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-base-content/70">
            You&apos;re on the public home route with the admin wallet connected. Jump into the operations dashboard or
            use the admin tools directly from here.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/admin" className="btn btn-primary h-14 rounded-2xl px-7 text-base">
              Open Admin Dashboard
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <Link href="/admin/flights" className="btn btn-outline h-14 rounded-2xl px-7 text-base">
              Manage Flights
            </Link>
            <Link href="/admin/oracle" className="btn btn-outline h-14 rounded-2xl px-7 text-base">
              Oracle Ops
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-base-300 bg-base-100 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%)]" />
        <div className="relative grid gap-10 px-6 py-10 md:px-10 md:py-14 lg:grid-cols-[minmax(0,1.15fr)_24rem] lg:items-center">
          <div>
            <div className="badge badge-outline border-primary/30 bg-primary/10 px-4 py-4 text-primary">
              Traveler Console
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
              Manage your flight cover from one clean home screen.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-base-content/70">
              Compare insurance plans, go straight into purchase, review your existing policies, and check the mock
              oracle workflow without needing to rely only on the nav bar.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/insurance-plans" className="btn btn-primary h-14 rounded-2xl px-7 text-base">
                Explore Plans
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link href="/buy-policy" className="btn btn-outline h-14 rounded-2xl px-7 text-base">
                Buy Policy
              </Link>
              <Link href="/my-policies" className="btn btn-outline h-14 rounded-2xl px-7 text-base">
                View My Policies
              </Link>
            </div>

            <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-base-300 bg-base-100/80 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">Coverage Menu</div>
                <div className="mt-2 text-2xl font-bold">4 plans</div>
              </div>
              <div className="rounded-2xl border border-base-300 bg-base-100/80 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">Starting Premium</div>
                <div className="mt-2 text-2xl font-bold">10 USDC</div>
              </div>
              <div className="rounded-2xl border border-base-300 bg-base-100/80 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">Oracle Model</div>
                <div className="mt-2 text-2xl font-bold">Postgres-backed</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-5 shadow-lg">
              {!isConnected ? (
                <>
                  <div className="text-sm uppercase tracking-[0.2em] text-base-content/45">Wallet Connection</div>
                  <div className="mt-2 text-xl font-bold">Connect when you&apos;re ready</div>
                  <p className="mt-3 text-sm leading-7 text-base-content/65">
                    You can browse first and connect your wallet once you&apos;re ready to buy or review policies.
                  </p>
                  <div className="mt-4">
                    <RainbowKitCustomConnectButton />
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm uppercase tracking-[0.2em] text-base-content/45">Connected Wallet</div>
                  <div className="mt-3">
                    <Address
                      address={connectedAddress}
                      chain={targetNetwork}
                      blockExplorerAddressLink={
                        targetNetwork.id === hardhat.id ? `/blockexplorer/address/${connectedAddress}` : undefined
                      }
                    />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-base-content/65">
                    Your wallet is ready for policy purchase and review.
                  </p>
                  <div className="mt-4 rounded-2xl border border-success/20 bg-success/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">Wallet USDC</div>
                    <div className="mt-2 text-2xl font-black text-success">{formatUsdcBalance(walletUsdcBalance)}</div>
                    <div className="mt-2 text-sm leading-6 text-base-content/65">
                      This updates from the live MockUSDC balance, so payout increases are easy to show during the demo.
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <ShieldCheckIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-base-content/45">Suggested Start</div>
                  <div className="mt-1 text-xl font-bold">Compare plans first</div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/65">
                The best first stop is still the plans page, but this home screen now acts like a quick operations hub
                for travelers.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <UserMetricCard
          title="Plans"
          value="4 options"
          subtitle="Compare delay and cancellation covers side by side."
          tone="primary"
        />
        <UserMetricCard
          title="Buy Flow"
          value="Auto-filled"
          subtitle="Flight number search prepares departure time before checkout."
          tone="success"
        />
        <UserMetricCard
          title="Policy View"
          value="On-chain"
          subtitle="Review purchased policies and their contract status."
          tone="secondary"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Quick Actions</h2>
          <p className="mt-2 text-sm leading-7 text-base-content/65">
            Jump directly into the main traveler tasks from this overview page.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Link
              href="/insurance-plans"
              className="rounded-3xl border border-base-300 bg-base-200/60 p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-center gap-3 text-primary">
                <ShieldCheckIcon className="h-6 w-6" />
                <div className="text-lg font-semibold">Compare Plans</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/65">
                Browse delay and cancellation coverage options before committing.
              </p>
            </Link>

            <Link
              href="/buy-policy"
              className="rounded-3xl border border-base-300 bg-base-200/60 p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-center gap-3 text-secondary">
                <MagnifyingGlassCircleIcon className="h-6 w-6" />
                <div className="text-lg font-semibold">Buy Policy</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/65">
                Head straight into checkout if you already know the flight and cover you want.
              </p>
            </Link>

            <Link
              href="/my-policies"
              className="rounded-3xl border border-base-300 bg-base-200/60 p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-center gap-3 text-success">
                <ClipboardDocumentListIcon className="h-6 w-6" />
                <div className="text-lg font-semibold">My Policies</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/65">
                Review your purchased cover and current contract status in one place.
              </p>
            </Link>

            <div className="rounded-3xl border border-base-300 bg-base-200/60 p-5">
              <div className="flex items-center gap-3 text-info">
                <GlobeAltIcon className="h-6 w-6" />
                <div className="text-lg font-semibold">Claim Flow</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/65">
                Oracle and payout processing remain admin-driven in this MVP, but this home page gives travelers a clear
                overview of the full journey.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
          <h2 className="text-2xl font-bold">System Notes</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-base-200/60 p-4">
              <div className="font-semibold">Plan-first journey</div>
              <div className="mt-2 text-sm leading-7 text-base-content/65">
                Travelers can still start with plans, but they no longer get forced there when opening home.
              </div>
            </div>
            <div className="rounded-2xl bg-base-200/60 p-4">
              <div className="font-semibold">Purchase support</div>
              <div className="mt-2 text-sm leading-7 text-base-content/65">
                Flight lookup helps lock in departure timing before policy purchase.
              </div>
            </div>
            <div className="rounded-2xl bg-base-200/60 p-4">
              <div className="font-semibold">MVP scope</div>
              <div className="mt-2 text-sm leading-7 text-base-content/65">
                Oracle checks and payout fulfillment are still routed through admin tooling in the current demo.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
