"use client";

import { useState } from "react";
import { encodeAbiParameters } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { notification } from "~~/utils/scaffold-eth";

const oracleCoordinatorAbi = [
  {
    type: "function",
    name: "performUpkeep",
    stateMutability: "nonpayable",
    inputs: [{ name: "performData", type: "bytes" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fulfillOracleCheck",
    stateMutability: "nonpayable",
    inputs: [
      { name: "policyId", type: "uint256" },
      { name: "outcome", type: "uint8" },
      { name: "delayMinutes", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setReporter",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reporter", type: "address" },
      { name: "isAuthorized", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "reporters",
    stateMutability: "view",
    inputs: [{ name: "reporter", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "automationForwarder",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "requestsByPolicyId",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "requestId", type: "uint256" },
          { name: "policyId", type: "uint256" },
          { name: "requestedAt", type: "uint256" },
          { name: "fulfilledAt", type: "uint256" },
          { name: "pending", type: "bool" },
          { name: "fulfilled", type: "bool" },
          { name: "outcome", type: "uint8" },
          { name: "delayMinutes", type: "uint256" },
          { name: "payoutExecuted", type: "bool" },
          { name: "payoutAmount", type: "uint256" },
        ],
      },
    ],
  },
] as const;

type OracleRequestState = {
  requestId: bigint;
  policyId: bigint;
  requestedAt: bigint;
  fulfilledAt: bigint;
  pending: boolean;
  fulfilled: boolean;
  outcome: number;
  delayMinutes: bigint;
  payoutExecuted: boolean;
  payoutAmount: bigint;
};

type OracleDecisionResponse = {
  data: {
    policy: {
      policyId: string;
      flightNumber: string;
      departureTimestamp: string;
      policyType: number;
      status: number;
      delayThresholdMinutes: string;
    };
    flight: {
      id: string;
      flightNumber: string;
      currentStatus: string;
      scheduledDeparture: string;
      latestNote: string | null;
    };
    oracle: {
      outcome: number;
      delayMinutes: number;
      payoutEligible: boolean;
      reason: string;
    };
  };
};

export const OracleAutomationPanel = () => {
  const { address, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const chainId = chain?.id as keyof typeof deployedContracts | undefined;
  const chainContracts = chainId
    ? ((deployedContracts as Record<number, { OracleCoordinator?: { address: string } }>)[Number(chainId)] ?? undefined)
    : undefined;
  const oracleCoordinatorAddress = chainContracts?.OracleCoordinator?.address as `0x${string}` | undefined;

  const [policyId, setPolicyId] = useState("1");
  const [loading, setLoading] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<OracleDecisionResponse["data"] | null>(null);

  const parsedPolicyId = policyId.trim() && /^\d+$/.test(policyId.trim()) ? BigInt(policyId.trim()) : undefined;

  const { data: isReporter, refetch: refetchReporter } = useReadContract({
    address: oracleCoordinatorAddress,
    abi: oracleCoordinatorAbi,
    functionName: "reporters",
    args: address ? [address] : undefined,
    query: {
      enabled: !!oracleCoordinatorAddress && !!address,
    },
  });

  const { data: coordinatorOwner } = useReadContract({
    address: oracleCoordinatorAddress,
    abi: oracleCoordinatorAbi,
    functionName: "owner",
    query: {
      enabled: !!oracleCoordinatorAddress,
    },
  });

  const { data: automationForwarder } = useReadContract({
    address: oracleCoordinatorAddress,
    abi: oracleCoordinatorAbi,
    functionName: "automationForwarder",
    query: {
      enabled: !!oracleCoordinatorAddress,
    },
  });

  const { data: requestState, refetch: refetchRequestState } = useReadContract({
    address: oracleCoordinatorAddress,
    abi: oracleCoordinatorAbi,
    functionName: "requestsByPolicyId",
    args: parsedPolicyId ? [parsedPolicyId] : undefined,
    query: {
      enabled: !!oracleCoordinatorAddress && !!parsedPolicyId,
    },
  });

  const isAutomationAuthorized =
    !!address &&
    (!!coordinatorOwner && coordinatorOwner.toLowerCase() === address.toLowerCase()
      ? true
      : !!automationForwarder && automationForwarder.toLowerCase() === address.toLowerCase());

  const canSelfAuthorizeReporter =
    !!address && !!coordinatorOwner && coordinatorOwner.toLowerCase() === address.toLowerCase();

  const handleEvaluate = async () => {
    if (!parsedPolicyId) {
      setDecision(null);
      setError("Enter a valid numeric policy ID.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/oracle/policies/${parsedPolicyId.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as OracleDecisionResponse | { error?: string };

      if (!response.ok || !("data" in payload)) {
        throw new Error("error" in payload ? payload.error : "Failed to evaluate policy");
      }

      setDecision(payload.data);
    } catch (caughtError) {
      setDecision(null);
      setError(caughtError instanceof Error ? caughtError.message : "Failed to evaluate policy");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayout = async () => {
    if (!decision || !oracleCoordinatorAddress || !parsedPolicyId) {
      notification.error("Load an oracle decision first.");
      return;
    }

    if (!address || !publicClient) {
      notification.error("Connect the admin wallet first.");
      return;
    }

    if (!isAutomationAuthorized) {
      notification.error("Connected wallet is not authorized to perform oracle upkeep.");
      return;
    }

    try {
      setProcessingPayout(true);

      if (!isReporter) {
        if (!canSelfAuthorizeReporter) {
          notification.error("Connected wallet is not authorized to add itself as an oracle reporter.");
          return;
        }

        const reporterTxHash = await writeContractAsync({
          address: oracleCoordinatorAddress,
          abi: oracleCoordinatorAbi,
          functionName: "setReporter",
          args: [address, true],
        });
        await publicClient.waitForTransactionReceipt({ hash: reporterTxHash });
        await refetchReporter();
      }

      const currentRequest = requestState as OracleRequestState | undefined;
      if (!currentRequest?.pending && !currentRequest?.fulfilled) {
        const performData = encodeAbiParameters([{ type: "uint256" }], [parsedPolicyId]);
        const upkeepTxHash = await writeContractAsync({
          address: oracleCoordinatorAddress,
          abi: oracleCoordinatorAbi,
          functionName: "performUpkeep",
          args: [performData],
        });
        await publicClient.waitForTransactionReceipt({ hash: upkeepTxHash });
        await refetchRequestState();
      }

      const fulfillTxHash = await writeContractAsync({
        address: oracleCoordinatorAddress,
        abi: oracleCoordinatorAbi,
        functionName: "fulfillOracleCheck",
        args: [parsedPolicyId, decision.oracle.outcome, BigInt(decision.oracle.delayMinutes)],
      });
      await publicClient.waitForTransactionReceipt({ hash: fulfillTxHash });

      await Promise.all([refetchRequestState(), handleEvaluate()]);
      notification.success("Oracle fulfillment submitted and payout flow processed.");
    } catch (caughtError: any) {
      notification.error(caughtError?.shortMessage || caughtError?.message || "Failed to process payout.");
    } finally {
      setProcessingPayout(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Oracle Automation Mock</h1>
        <p className="mt-3 max-w-3xl text-base-content/70">
          This screen simulates the Postgres-to-oracle decision step after policy purchase. It reads the on-chain
          policy, checks the flight status stored in Postgres, and shows the payout decision that the oracle should
          fulfill.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="number"
            min="1"
            value={policyId}
            onChange={event => setPolicyId(event.target.value)}
            className="input input-bordered w-full rounded-2xl sm:max-w-xs"
            placeholder="Policy ID"
          />
          <button className="btn btn-primary rounded-2xl" onClick={() => void handleEvaluate()} disabled={loading}>
            {loading ? "Evaluating..." : "Run Mock Oracle Check"}
          </button>
          <button
            className="btn btn-secondary rounded-2xl"
            onClick={() => void handleProcessPayout()}
            disabled={!decision || processingPayout || !oracleCoordinatorAddress || !parsedPolicyId}
          >
            {processingPayout ? "Processing..." : "Process On-Chain Payout"}
          </button>
        </div>

        {oracleCoordinatorAddress ? (
          <div className="mt-4 text-xs text-base-content/60">
            OracleCoordinator: <span className="font-mono">{oracleCoordinatorAddress}</span>
          </div>
        ) : (
          <div className="mt-4 text-xs text-warning">
            OracleCoordinator deployment not found for the connected chain.
          </div>
        )}

        {oracleCoordinatorAddress ? (
          <div className="mt-2 text-xs text-base-content/60">
            Coordinator owner: <span className="font-mono">{coordinatorOwner ?? "Loading..."}</span>
          </div>
        ) : null}

        {oracleCoordinatorAddress ? (
          <div className="mt-2 text-xs text-base-content/60">
            Automation forwarder: <span className="font-mono">{automationForwarder ?? "Not set"}</span>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="alert alert-error rounded-2xl">
          <span>{error}</span>
        </div>
      ) : null}

      {decision ? (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-base-content/50">Policy</div>
            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="font-semibold">Policy ID:</span> {decision.policy.policyId}
              </div>
              <div>
                <span className="font-semibold">Flight:</span> {decision.policy.flightNumber}
              </div>
              <div>
                <span className="font-semibold">Policy Type:</span>{" "}
                {decision.policy.policyType === 0 ? "Flight Delay" : "Flight Cancellation"}
              </div>
              <div>
                <span className="font-semibold">Delay Threshold:</span>{" "}
                {Number(decision.policy.delayThresholdMinutes) / 60} hours
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-base-content/50">
              Postgres Flight
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="font-semibold">Status:</span> {decision.flight.currentStatus}
              </div>
              <div>
                <span className="font-semibold">Scheduled Departure:</span>{" "}
                {new Date(decision.flight.scheduledDeparture).toLocaleString()}
              </div>
              <div>
                <span className="font-semibold">Latest Note:</span> {decision.flight.latestNote ?? "No note"}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-base-content/50">
              Oracle Decision
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="font-semibold">Outcome Code:</span> {decision.oracle.outcome}
              </div>
              <div>
                <span className="font-semibold">Delay Minutes:</span> {decision.oracle.delayMinutes}
              </div>
              <div>
                <span className="font-semibold">Payout:</span>{" "}
                {decision.oracle.payoutEligible ? "Eligible" : "Not eligible"}
              </div>
              <div>
                <span className="font-semibold">Reason:</span> {decision.oracle.reason}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-base-content/50">
              On-Chain Request
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="font-semibold">Reporter Authorized:</span> {isReporter ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-semibold">Can Trigger Upkeep:</span> {isAutomationAuthorized ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-semibold">Request Pending:</span>{" "}
                {(requestState as OracleRequestState | undefined)?.pending ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-semibold">Request Fulfilled:</span>{" "}
                {(requestState as OracleRequestState | undefined)?.fulfilled ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-semibold">Payout Executed:</span>{" "}
                {(requestState as OracleRequestState | undefined)?.payoutExecuted ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-semibold">Payout Amount:</span>{" "}
                {Number((requestState as OracleRequestState | undefined)?.payoutAmount ?? 0n) / 1_000_000} USDC
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
