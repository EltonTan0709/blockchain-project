"use client";

import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { ShieldCheckIcon, TicketIcon, WalletIcon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useAdminWallet } from "~~/hooks/scaffold-eth/useAdminWallet";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { isAdmin, isConnected } = useAdminWallet();
  const { targetNetwork } = useTargetNetwork();

  const primaryActions = isAdmin
    ? [
        { label: "Buy Policy", href: "/buy-policy", style: "btn btn-primary" },
        { label: "My Policies", href: "/my-policies", style: "btn btn-outline" },
        { label: "Pool", href: "/pool", style: "btn btn-secondary" },
        { label: "Admin", href: "/admin", style: "btn btn-outline" },
      ]
    : isConnected
      ? [
          { label: "Buy Policy", href: "/buy-policy", style: "btn btn-primary" },
          { label: "My Policies", href: "/my-policies", style: "btn btn-secondary" },
          { label: "Plans", href: "/insurance-plans", style: "btn btn-outline" },
        ]
      : [
          { label: "Browse Plans", href: "/insurance-plans", style: "btn btn-primary" },
          { label: "Buy Policy", href: "/buy-policy", style: "btn btn-outline" },
        ];

  const quickCards = [
    {
      title: "Browse Plans",
      description: "Review flight delay and cancellation coverage before purchasing.",
      href: "/insurance-plans",
      icon: <ShieldCheckIcon className="h-6 w-6" />,
    },
    {
      title: "Buy Policy",
      description: "Pay mock premiums in MockUSDC and mint an on-chain policy record.",
      href: "/buy-policy",
      icon: <TicketIcon className="h-6 w-6" />,
    },
    {
      title: isAdmin ? "Manage Flights" : "My Policies",
      description: isAdmin
        ? "Update flight statuses for the MVP admin workflow and review status history."
        : "Track purchased coverage and view live policy state from your wallet.",
      href: isAdmin ? "/admin/flights" : "/my-policies",
      icon: <WalletIcon className="h-6 w-6" />,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-10">
      <section className="rounded-[2rem] border border-base-300 bg-base-100 p-8 shadow-xl md:p-12">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
          <div>
            <div className="badge badge-outline mb-4">Flight Insurance MVP</div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Wallet-based flight protection with on-chain policy tracking.
            </h1>
            <p className="mt-4 max-w-2xl text-base-content/70 md:text-lg">
              Browse coverage plans, pay premiums in MockUSDC, and manage your policy history directly from your wallet.
              Admins can also manage the pool and update flight statuses for the MVP demo flow.
            </p>

            {!isConnected ? (
              <div className="mt-6 rounded-2xl border border-base-300 bg-base-200 p-4">
                <div className="font-medium">Connect a wallet to start buying and tracking policies.</div>
                <div className="mt-3">
                  <RainbowKitCustomConnectButton />
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-base-300 bg-base-200 p-4">
                <div className="text-sm font-medium text-base-content/70">Connected wallet</div>
                <div className="mt-2">
                  <Address
                    address={connectedAddress}
                    chain={targetNetwork}
                    blockExplorerAddressLink={
                      targetNetwork.id === hardhat.id ? `/blockexplorer/address/${connectedAddress}` : undefined
                    }
                  />
                </div>
                <div className="mt-3 text-sm text-base-content/70">
                  {isAdmin
                    ? "Admin wallet detected. Pool and admin tools are available."
                    : "User wallet detected. Browse plans, buy coverage, and track your policies."}
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {primaryActions.map(action => (
                <Link key={action.href} href={action.href} className={action.style}>
                  {action.label}
                </Link>
              ))}
              {isAdmin ? (
                <Link href="/admin/flights" className="btn btn-outline">
                  Manage Flights
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-base-200 p-6">
            <h2 className="text-2xl font-semibold">What this demo includes</h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-base-100 p-4">
                <div className="font-semibold">Flight delay and cancellation plans</div>
                <div className="mt-1 text-sm text-base-content/70">
                  Predefined coverage options that route users into the buy-policy flow.
                </div>
              </div>
              <div className="rounded-2xl bg-base-100 p-4">
                <div className="font-semibold">Wallet-native policy ownership</div>
                <div className="mt-1 text-sm text-base-content/70">
                  Policies are purchased and tracked by connected wallet, without separate usernames or passwords.
                </div>
              </div>
              <div className="rounded-2xl bg-base-100 p-4">
                <div className="font-semibold">Admin flight operations for MVP settlement flow</div>
                <div className="mt-1 text-sm text-base-content/70">
                  Admins can manage pool access and update mock flight statuses used by the demo workflow.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {quickCards.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="text-primary">{card.icon}</div>
            <h2 className="mt-4 text-2xl font-semibold">{card.title}</h2>
            <p className="mt-3 text-sm text-base-content/70">{card.description}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-3xl border border-base-300 bg-base-100 p-8 shadow-sm">
        <h2 className="text-3xl font-bold">How It Works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-base-200 p-5">
            <div className="text-sm font-semibold text-primary">Step 1</div>
            <div className="mt-2 text-xl font-semibold">Connect Wallet</div>
            <p className="mt-2 text-sm text-base-content/70">
              Connect your wallet to identify yourself and interact with the insurance flows.
            </p>
          </div>
          <div className="rounded-2xl bg-base-200 p-5">
            <div className="text-sm font-semibold text-primary">Step 2</div>
            <div className="mt-2 text-xl font-semibold">Buy Policy</div>
            <p className="mt-2 text-sm text-base-content/70">
              Choose a plan, approve MockUSDC, and purchase a policy tied to your connected wallet.
            </p>
          </div>
          <div className="rounded-2xl bg-base-200 p-5">
            <div className="text-sm font-semibold text-primary">Step 3</div>
            <div className="mt-2 text-xl font-semibold">Track Policy / Settlement</div>
            <p className="mt-2 text-sm text-base-content/70">
              Review policy state on-chain while admins update mock flight statuses for the MVP settlement flow.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-base-300 bg-base-100 p-8 shadow-sm">
        <h2 className="text-3xl font-bold">Highlights</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-base-200 p-5">
            <div className="font-semibold">MockUSDC Premium Payments</div>
            <p className="mt-2 text-sm text-base-content/70">
              Premium collection and liquidity flows run through a stablecoin-like test asset for the demo.
            </p>
          </div>
          <div className="rounded-2xl bg-base-200 p-5">
            <div className="font-semibold">On-Chain Policy Tracking</div>
            <p className="mt-2 text-sm text-base-content/70">
              Purchased policies remain linked to wallet identity and can be reviewed from the policy pages.
            </p>
          </div>
          <div className="rounded-2xl bg-base-200 p-5">
            <div className="font-semibold">Admin-Managed Flight Status Updates</div>
            <p className="mt-2 text-sm text-base-content/70">
              The MVP uses admin-managed status updates before adding oracle-backed automation later.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
