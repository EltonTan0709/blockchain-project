"use client";

import { formatUnits } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { CONTRACTS } from "~~/utils/scaffold-eth/contract";
import {
  formatUnixTimestamp,
  getContractStatusText,
  getDisplayPolicyStatus,
  getPolicyTypeText,
  getStatusBadgeClass,
} from "~~/utils/scaffold-eth/policyStatus";

const policyManagerAbi = [
  {
    type: "function",
    name: "getUserPolicies",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
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

type PolicyStruct = {
  policyId: bigint;
  holder: `0x${string}`;
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

export const MyPolicies = () => {
  const { address, chain, isConnected } = useAccount();
  const chainId = chain?.id as keyof typeof deployedContracts | undefined;
  const chainContracts = chainId
    ? ((deployedContracts as Record<number, { PolicyManager?: { address: string } }>)[Number(chainId)] ?? undefined)
    : undefined;

  const TOKEN_DECIMALS = CONTRACTS.TOKEN_DECIMALS;
  const POLICY_MANAGER_ADDRESS =
    (chainContracts?.PolicyManager?.address as `0x${string}` | undefined) ?? (CONTRACTS.PolicyManager as `0x${string}`);

  const {
    data: userPolicyIds,
    isLoading: isLoadingPolicyIds,
    refetch: refetchPolicyIds,
  } = useReadContract({
    address: POLICY_MANAGER_ADDRESS,
    abi: policyManagerAbi,
    functionName: "getUserPolicies",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const policyIds = Array.isArray(userPolicyIds) ? (userPolicyIds as bigint[]) : [];

  const {
    data: policiesData,
    isLoading: isLoadingPolicies,
    refetch: refetchPolicies,
  } = useReadContracts({
    contracts: policyIds.map(policyId => ({
      address: POLICY_MANAGER_ADDRESS,
      abi: policyManagerAbi,
      functionName: "getPolicy",
      args: [policyId],
    })),
    query: {
      enabled: policyIds.length > 0,
    },
  });

  const policies: PolicyStruct[] =
    (policiesData as any[] | undefined)?.flatMap(item => {
      if (item.status !== "success" || !item.result) return [];
      return [item.result as PolicyStruct];
    }) ?? [];

  const refreshAll = async () => {
    await refetchPolicyIds();
    await refetchPolicies();
  };

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl border bg-base-100 p-8 shadow-xl">
          <h1 className="text-3xl font-bold">My Policies</h1>
          <p className="mt-3 text-base-content/70">Connect your wallet to view your purchased insurance policies.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <div className="rounded-3xl border bg-base-100 p-8 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Policies</h1>
            <p className="mt-2 text-base-content/70">View the insurance policies you have purchased on-chain.</p>
          </div>

          <button className="btn btn-outline btn-primary" onClick={refreshAll}>
            Refresh
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-base-200 p-4 text-sm">
          <div>
            <span className="font-semibold">Connected Wallet:</span> {address}
          </div>
          <div className="mt-1">
            <span className="font-semibold">Total Policies:</span> {policyIds.length}
          </div>
        </div>
      </div>

      {(isLoadingPolicyIds || isLoadingPolicies) && (
        <div className="rounded-3xl border bg-base-100 p-8 shadow-xl">
          <p>Loading policies...</p>
        </div>
      )}

      {!isLoadingPolicyIds && policyIds.length === 0 && (
        <div className="rounded-3xl border bg-base-100 p-8 shadow-xl">
          <h2 className="text-xl font-bold">No policies found</h2>
          <p className="mt-2 text-base-content/70">You have not purchased any insurance policies yet.</p>
        </div>
      )}

      {policies.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {policies
            .slice()
            .sort((a, b) => Number(b.policyId - a.policyId))
            .map(policy => {
              const displayStatus = getDisplayPolicyStatus(policy.status, policy.endTime);

              return (
                <div key={policy.policyId.toString()} className="rounded-3xl border bg-base-100 p-6 shadow-xl">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm text-base-content/60">Policy #{policy.policyId.toString()}</div>
                      <h2 className="mt-1 text-2xl font-bold">{policy.flightNumber}</h2>
                      <p className="mt-1 text-base-content/70">{getPolicyTypeText(policy.policyType)}</p>
                    </div>

                    <div className={getStatusBadgeClass(displayStatus)}>{displayStatus}</div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl bg-base-200 p-4 text-sm md:grid-cols-2">
                    <div>
                      <span className="font-semibold">Coverage:</span>{" "}
                      {formatUnits(policy.coverageAmount, TOKEN_DECIMALS)} USDC
                    </div>
                    <div>
                      <span className="font-semibold">Premium:</span> {formatUnits(policy.premium, TOKEN_DECIMALS)} USDC
                    </div>
                    <div>
                      <span className="font-semibold">Purchase Time:</span> {formatUnixTimestamp(policy.purchaseTime)}
                    </div>
                    <div>
                      <span className="font-semibold">Departure Time:</span>{" "}
                      {formatUnixTimestamp(policy.departureTimestamp)}
                    </div>
                    <div>
                      <span className="font-semibold">Coverage Ends:</span> {formatUnixTimestamp(policy.endTime)}
                    </div>
                    {policy.policyType === 0 ? (
                      <div>
                        <span className="font-semibold">Delay Threshold:</span>{" "}
                        {Number(policy.delayThresholdMinutes) / 60} hours
                      </div>
                    ) : null}
                    <div>
                      <span className="font-semibold">On-chain Status:</span> {getContractStatusText(policy.status)}
                    </div>
                    <div className="md:col-span-2 break-all">
                      <span className="font-semibold">Holder:</span> {policy.holder}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-base-300 bg-base-50 p-4 text-sm">
                    <div className="font-semibold">Summary</div>
                    <p className="mt-2 text-base-content/70">
                      This policy covers <span className="font-medium">{policy.flightNumber}</span> under{" "}
                      <span className="font-medium">{getPolicyTypeText(policy.policyType)}</span> with coverage of{" "}
                      <span className="font-medium">{formatUnits(policy.coverageAmount, TOKEN_DECIMALS)} USDC</span>.
                      The premium paid was{" "}
                      <span className="font-medium">{formatUnits(policy.premium, TOKEN_DECIMALS)} USDC</span>.
                    </p>
                    <p className="mt-2 text-base-content/70">
                      Current display status: <span className="font-medium">{displayStatus}</span>.
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
