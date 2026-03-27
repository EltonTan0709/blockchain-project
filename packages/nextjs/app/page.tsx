"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import { ArrowRightIcon, CheckBadgeIcon, GlobeAltIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useAdminWallet } from "~~/hooks/scaffold-eth/useAdminWallet";

const Home: NextPage = () => {
  const router = useRouter();
  const { address: connectedAddress } = useAccount();
  const { isAdmin, isConnected } = useAdminWallet();
  const { targetNetwork } = useTargetNetwork();

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    router.replace(isAdmin ? "/admin" : "/insurance-plans");
  }, [isAdmin, isConnected, router]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-base-300 bg-base-100 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%)]" />
        <div className="relative grid gap-10 px-6 py-10 md:px-10 md:py-14 lg:grid-cols-[minmax(0,1.15fr)_24rem] lg:items-center">
          <div>
            <div className="badge badge-outline border-primary/30 bg-primary/10 px-4 py-4 text-primary">
              Flight Insurance MVP
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
              Protect your trip with a simple, wallet-native insurance flow.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-base-content/70">
              Browse curated flight delay and cancellation plans, choose the coverage that fits your trip, and continue
              to checkout with your policy details already prepared.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/insurance-plans" className="btn btn-primary h-14 rounded-2xl px-7 text-base">
                Explore Plans
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              {isConnected ? (
                <Link href="/my-policies" className="btn btn-outline h-14 rounded-2xl px-7 text-base">
                  View My Policies
                </Link>
              ) : null}
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
                <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">Claims Model</div>
                <div className="mt-2 text-2xl font-bold">Auto-triggered</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <ShieldCheckIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-base-content/45">How It Starts</div>
                  <div className="mt-1 text-xl font-bold">Choose a plan first</div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-7 text-base-content/65">
                The home page is your entry point. Once you click the CTA, the plans page handles comparison and
                selection.
              </p>
            </div>

            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-5 shadow-lg">
              {!isConnected ? (
                <>
                  <div className="text-sm uppercase tracking-[0.2em] text-base-content/45">Wallet Connection</div>
                  <div className="mt-2 text-xl font-bold">Connect when you&apos;re ready</div>
                  <p className="mt-3 text-sm leading-7 text-base-content/65">
                    You can explore plans first, then connect your wallet when you move into policy purchase.
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
                    {isAdmin
                      ? "Admin wallet detected. You can still explore plans first, then move into admin tools separately."
                      : "You&apos;re all set to browse plans and continue into purchase when you find the right cover."}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 text-primary">
            <CheckBadgeIcon className="h-6 w-6" />
            <div className="text-lg font-semibold">Compare with confidence</div>
          </div>
          <p className="mt-3 text-sm leading-7 text-base-content/70">
            Review delay and cancellation plans in one place before committing to checkout.
          </p>
        </div>

        <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 text-success">
            <ShieldCheckIcon className="h-6 w-6" />
            <div className="text-lg font-semibold">Clear pricing and coverage</div>
          </div>
          <p className="mt-3 text-sm leading-7 text-base-content/70">
            Each plan shows premium, payout range, trigger condition, and policy window up front.
          </p>
        </div>

        <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 text-secondary">
            <GlobeAltIcon className="h-6 w-6" />
            <div className="text-lg font-semibold">Smooth flow into checkout</div>
          </div>
          <p className="mt-3 text-sm leading-7 text-base-content/70">
            Selecting a plan sends you into the buy-policy flow with the important values already filled in.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Home;
