"use client";

import { PropsWithChildren } from "react";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useAdminWallet } from "~~/hooks/scaffold-eth/useAdminWallet";

type AdminRouteGuardProps = PropsWithChildren<{
  accessLabel?: string;
  connectDescription?: string;
}>;

export const AdminRouteGuard = ({
  children,
  accessLabel = "admin area",
  connectDescription = "Connect the configured admin wallet to access this page.",
}: AdminRouteGuardProps) => {
  const { adminWallet, hasConfiguredAdminWallet, isAdmin, isConnected } = useAdminWallet();

  if (!hasConfiguredAdminWallet) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-10">
        <div className="w-full rounded-3xl border bg-base-100 p-8 shadow-xl">
          <h1 className="text-3xl font-bold">Admin Access Unavailable</h1>
          <p className="mt-3 text-base-content/70">
            This environment is missing a valid <code>NEXT_PUBLIC_ADMIN_WALLET</code> configuration.
          </p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-10">
        <div className="w-full rounded-3xl border bg-base-100 p-8 shadow-xl">
          <h1 className="text-3xl font-bold">Connect Wallet</h1>
          <p className="mt-3 text-base-content/70">{connectDescription}</p>
          <div className="mt-6">
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-10">
        <div className="w-full rounded-3xl border bg-base-100 p-8 shadow-xl">
          <h1 className="text-3xl font-bold">Access Denied</h1>
          <p className="mt-3 text-base-content/70">
            The connected wallet is not authorized to access this {accessLabel}.
          </p>
          <div className="mt-4 rounded-2xl bg-base-200 p-4 text-sm">
            <div>
              <span className="font-semibold">Required admin wallet:</span> {adminWallet}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
