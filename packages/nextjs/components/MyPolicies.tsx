"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { formatFlightStatusLabel, formatOracleWorkerError, getOutcomeLabel } from "~~/lib/oracle-display";
import { CONTRACTS } from "~~/utils/scaffold-eth/contract";
import {
  formatUnixTimestamp,
  getContractStatusText,
  getDisplayPolicyStatus,
  getPolicyTypeText,
} from "~~/utils/scaffold-eth/policyStatus";

type OracleAuditMetadata = {
  reason?: string;
  winningVotes?: number;
  totalVotes?: number;
};

type OracleAuditRecord = {
  policyId: string;
  auditStatus: "REQUESTED" | "AWAITING_CHAINLINK" | "FULFILLED" | "FAILED" | "EXPIRED";
  usedChainlink: boolean;
  flightStatus: string | null;
  latestNote: string | null;
  outcome: number | null;
  payoutEligible: boolean | null;
  payoutExecuted: boolean | null;
  payoutAmount: string | null;
  errorMessage: string | null;
  metadata: OracleAuditMetadata | null;
};

type OracleAuditsResponse = {
  data: {
    audits: OracleAuditRecord[];
  };
};

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

type UserOracleStatus =
  | "Waiting For Flight"
  | "Pending Review"
  | "Payout Eligible"
  | "Paid Out"
  | "No Payout"
  | "Review Failed"
  | "Expired";

const getStoredReason = (audit: OracleAuditRecord | undefined) => {
  const storedReason = audit?.metadata?.reason;

  if (!storedReason) {
    return null;
  }

  if (storedReason.startsWith("Flight data is still unresolved in Postgres.") && audit?.flightStatus === "SCHEDULED") {
    return storedReason.replace(
      "Flight data is still unresolved in Postgres.",
      "Flight record exists, but it is still scheduled and no qualifying disruption has been recorded.",
    );
  }

  return storedReason;
};

const getUserOracleStatus = (
  policy: PolicyStruct,
  audit: OracleAuditRecord | undefined,
  displayStatus: ReturnType<typeof getDisplayPolicyStatus>,
): UserOracleStatus => {
  if (audit) {
    switch (audit.auditStatus) {
      case "FULFILLED":
        if (audit.payoutExecuted) {
          return "Paid Out";
        }

        return audit.payoutEligible ? "Payout Eligible" : "No Payout";
      case "FAILED":
        return "Review Failed";
      case "EXPIRED":
        return "Expired";
      case "REQUESTED":
      case "AWAITING_CHAINLINK":
      default:
        return "Pending Review";
    }
  }

  if (displayStatus === "Paid Out") {
    return "Paid Out";
  }
  if (displayStatus === "Rejected") {
    return "No Payout";
  }
  if (displayStatus === "Expired") {
    return "Expired";
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return Number(policy.departureTimestamp) > nowInSeconds ? "Waiting For Flight" : "Pending Review";
};

const getUserOracleStatusClass = (status: UserOracleStatus) => {
  switch (status) {
    case "Payout Eligible":
      return "badge badge-warning";
    case "Paid Out":
      return "badge badge-success";
    case "No Payout":
      return "badge badge-neutral";
    case "Review Failed":
      return "badge badge-error";
    case "Expired":
      return "badge badge-warning";
    case "Pending Review":
      return "badge badge-info";
    case "Waiting For Flight":
    default:
      return "badge badge-outline";
  }
};

const formatPayoutAmount = (amount: string | null | undefined) => {
  if (!amount) {
    return "0 USDC";
  }

  try {
    return `${formatUnits(BigInt(amount), CONTRACTS.TOKEN_DECIMALS)} USDC`;
  } catch {
    return `${amount} USDC`;
  }
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
  const [oracleAuditsByPolicyId, setOracleAuditsByPolicyId] = useState<Record<string, OracleAuditRecord>>({});
  const [isLoadingAudits, setIsLoadingAudits] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditRefreshTick, setAuditRefreshTick] = useState(0);

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

  const policyIdsQuery = useMemo(() => policyIds.map(policyId => policyId.toString()).join(","), [policyIds]);

  useEffect(() => {
    let isCancelled = false;

    const loadAudits = async () => {
      if (!policyIdsQuery) {
        if (!isCancelled) {
          setOracleAuditsByPolicyId({});
          setAuditError("");
          setIsLoadingAudits(false);
        }
        return;
      }

      try {
        if (!isCancelled) {
          setIsLoadingAudits(true);
        }

        const response = await fetch(`/api/oracle/audits?policyIds=${encodeURIComponent(policyIdsQuery)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as OracleAuditsResponse | { error?: string };

        if (!response.ok || !("data" in payload)) {
          throw new Error("error" in payload ? payload.error : "Failed to load oracle decision history.");
        }

        if (isCancelled) {
          return;
        }

        const nextAuditsByPolicyId = Object.fromEntries(
          payload.data.audits.map(audit => [audit.policyId, audit] as const),
        ) as Record<string, OracleAuditRecord>;

        setOracleAuditsByPolicyId(nextAuditsByPolicyId);
        setAuditError("");
      } catch (caughtError) {
        if (!isCancelled) {
          setAuditError(caughtError instanceof Error ? caughtError.message : "Failed to load oracle decision history.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAudits(false);
        }
      }
    };

    void loadAudits();

    return () => {
      isCancelled = true;
    };
  }, [policyIdsQuery, auditRefreshTick]);

  const refreshAll = async () => {
    await refetchPolicyIds();
    await refetchPolicies();
    setAuditRefreshTick(currentTick => currentTick + 1);
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

      {auditError ? (
        <div className="alert alert-warning rounded-3xl shadow-sm">
          <span>{auditError}</span>
        </div>
      ) : null}

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
              const policyAudit = oracleAuditsByPolicyId[policy.policyId.toString()];
              const oracleStatus = getUserOracleStatus(policy, policyAudit, displayStatus);
              const consensusLabel =
                policyAudit?.metadata?.winningVotes && policyAudit?.metadata?.totalVotes
                  ? `${policyAudit.metadata.winningVotes}/${policyAudit.metadata.totalVotes} sources agreed`
                  : oracleStatus === "Waiting For Flight"
                    ? "Not available yet"
                    : oracleStatus === "Pending Review"
                      ? "Awaiting oracle review"
                      : policyAudit
                        ? "Stored in oracle history"
                        : "No stored consensus snapshot";
              const reason =
                policyAudit?.auditStatus === "FAILED"
                  ? (formatOracleWorkerError(policyAudit.errorMessage) ??
                    "Oracle processing hit an error and may need to be retried.")
                  : (getStoredReason(policyAudit) ??
                    (oracleStatus === "Waiting For Flight"
                      ? "Oracle review becomes available after the flight reaches its evaluation time."
                      : oracleStatus === "Pending Review"
                        ? "This policy is waiting for the oracle workflow to finish."
                        : oracleStatus === "Payout Eligible"
                          ? "The oracle marked this policy as eligible. Payout should follow once settlement is completed on-chain."
                          : oracleStatus === "Paid Out"
                            ? "This policy met the payout conditions and the contract sent the payout on-chain."
                            : oracleStatus === "No Payout"
                              ? "The verified flight outcome did not meet the payout conditions for this policy."
                              : oracleStatus === "Expired"
                                ? "This policy has already closed and no newer oracle explanation is stored."
                                : "Oracle detail is not available for this policy yet."));

              return (
                <div key={policy.policyId.toString()} className="rounded-3xl border bg-base-100 p-6 shadow-xl">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm text-base-content/60">Policy #{policy.policyId.toString()}</div>
                      <h2 className="mt-1 text-2xl font-bold">{policy.flightNumber}</h2>
                      <p className="mt-1 text-base-content/70">{getPolicyTypeText(policy.policyType)}</p>
                    </div>

                    <div className={getUserOracleStatusClass(oracleStatus)}>{oracleStatus}</div>
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
                      <span className="font-semibold">Traveler Status:</span> {oracleStatus}
                    </div>
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
                      Current traveler status: <span className="font-medium">{oracleStatus}</span>.
                    </p>
                    <p className="mt-2 text-base-content/70">
                      On-chain contract status:{" "}
                      <span className="font-medium">{getContractStatusText(policy.status)}</span>.
                    </p>
                  </div>

                  <div className="mt-4 rounded-2xl border border-primary/10 bg-primary/5 p-4 text-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="font-semibold">Oracle Decision</div>
                      <div className={getUserOracleStatusClass(oracleStatus)}>{oracleStatus}</div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <span className="font-semibold">Consensus Result:</span> {consensusLabel}
                      </div>
                      <div>
                        <span className="font-semibold">Flight Outcome:</span>{" "}
                        {getOutcomeLabel(policyAudit?.outcome, policyAudit?.flightStatus, "Pending")}
                      </div>
                      {policyAudit?.flightStatus ? (
                        <div>
                          <span className="font-semibold">Flight Status:</span>{" "}
                          {formatFlightStatusLabel(policyAudit.flightStatus)}
                        </div>
                      ) : null}
                      {policyAudit?.payoutExecuted || policyAudit?.payoutAmount ? (
                        <div>
                          <span className="font-semibold">Recorded Payout:</span>{" "}
                          {policyAudit?.payoutExecuted ? formatPayoutAmount(policyAudit.payoutAmount) : "No payout"}
                        </div>
                      ) : null}
                    </div>

                    <p className="mt-3 leading-7 text-base-content/70">
                      <span className="font-semibold text-base-content">Reason:</span> {reason}
                    </p>

                    {policyAudit?.latestNote ? (
                      <p className="mt-2 leading-7 text-base-content/65">
                        <span className="font-semibold text-base-content">Latest Note:</span> {policyAudit.latestNote}
                      </p>
                    ) : null}

                    {isLoadingAudits && !policyAudit ? (
                      <p className="mt-2 text-base-content/55">Loading oracle decision details...</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
