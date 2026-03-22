"use client";

import { useMemo } from "react";
import { isAddress, isAddressEqual } from "viem";
import { useAccount } from "wagmi";

const configuredAdminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET?.trim();

export const useAdminWallet = () => {
  const { address, isConnected } = useAccount();

  return useMemo(() => {
    const hasConfiguredAdminWallet = !!configuredAdminWallet && isAddress(configuredAdminWallet);
    const adminWallet = hasConfiguredAdminWallet ? configuredAdminWallet : undefined;
    const isAdmin = !!address && !!adminWallet && isAddressEqual(address, adminWallet);

    return {
      address,
      adminWallet,
      hasConfiguredAdminWallet,
      isAdmin,
      isConnected,
    };
  }, [address, isConnected]);
};
