import { type FlightStatus, OracleRequestAuditStatus, Prisma } from "@prisma/client";
import { createPublicClient, createWalletClient, encodeAbiParameters, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getOracleDecisionForPolicy, getOracleDecisionReason, isOracleDecisionPayoutEligible } from "~~/lib/oracle";
import { ORACLE_REQUEST_STATUS, type OracleAuditMetadata } from "~~/lib/oracle-audit";
import { formatOracleWorkerError } from "~~/lib/oracle-display";
import { prisma } from "~~/lib/prisma";
import { getRuntimeContractAddresses } from "~~/lib/runtime-contract-addresses";
import scaffoldConfig from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth/networks";

type PolicySnapshot = {
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

type OracleWorkerCycleResult = {
  scannedPolicies: number;
  queuedPolicies: number;
  requestedPolicies: number;
  fulfilledPolicies: number;
  failedPolicies: number;
  expiredPolicies: number;
};

const ZERO_BYTES32 = `0x${"0".repeat(64)}` as const;

const policyManagerAbi = [
  {
    type: "function",
    name: "nextPolicyId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
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
  {
    type: "function",
    name: "getOracleReadyTimestamp",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

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

const chainlinkDemoOracleConsumerAbi = [
  {
    type: "function",
    name: "requestPolicyEvaluation",
    stateMutability: "nonpayable",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "activeChainlinkRequestIdByPolicyId",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "submitConsensusResult",
    stateMutability: "nonpayable",
    inputs: [
      { name: "policyId", type: "uint256" },
      { name: "outcome", type: "uint8" },
      { name: "delayMinutes", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const targetNetwork = scaffoldConfig.targetNetworks[0];
const rpcOverrides = scaffoldConfig.rpcOverrides as Record<number, string> | undefined;
const fallbackRpcUrl =
  rpcOverrides?.[targetNetwork.id] ?? getAlchemyHttpUrl(targetNetwork.id) ?? targetNetwork.rpcUrls.default.http[0];

const { oracleCoordinatorAddress, policyManagerAddress, chainlinkDemoOracleConsumerAddress } =
  getRuntimeContractAddresses();
const isChainlinkFunctionsEnabled = process.env.CHAINLINK_FUNCTIONS_ENABLED === "true";

const publicClient = createPublicClient({
  chain: targetNetwork,
  transport: http(fallbackRpcUrl),
});

const normalizePrivateKey = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.trim().replace(/^['"]|['"]$/g, "");
  return normalizedValue as `0x${string}`;
};

const getAutomationPrivateKey = () => {
  const configuredPrivateKey = normalizePrivateKey(process.env.ORACLE_AUTOMATION_PRIVATE_KEY);

  return configuredPrivateKey;
};

const getWalletClient = () => {
  const automationPrivateKey = getAutomationPrivateKey();
  if (!automationPrivateKey) {
    throw new Error("Missing ORACLE_AUTOMATION_PRIVATE_KEY for automatic oracle processing.");
  }

  if (!automationPrivateKey.startsWith("0x") || automationPrivateKey.length !== 66) {
    throw new Error("ORACLE_AUTOMATION_PRIVATE_KEY must be a 32-byte hex private key starting with 0x.");
  }

  const account = privateKeyToAccount(automationPrivateKey);

  return createWalletClient({
    account,
    chain: targetNetwork,
    transport: http(fallbackRpcUrl),
  });
};

const getOracleReadyTimestamp = async (policyId: bigint, fallbackTimestamp: bigint) => {
  if (!policyManagerAddress) {
    return fallbackTimestamp;
  }

  return publicClient
    .readContract({
      address: policyManagerAddress,
      abi: policyManagerAbi,
      functionName: "getOracleReadyTimestamp",
      args: [policyId],
    })
    .catch(() => fallbackTimestamp);
};

const getRequestStatusCode = (request: OracleRequestState) => {
  if (request.fulfilled) {
    return ORACLE_REQUEST_STATUS.FULFILLED;
  }

  if (request.pending || request.requestId > 0n) {
    return ORACLE_REQUEST_STATUS.REQUESTED;
  }

  return ORACLE_REQUEST_STATUS.IDLE;
};

const upsertAuditRecord = async (params: {
  policyId: bigint;
  requestId?: bigint | null;
  chainlinkRequestId?: string | null;
  requestStatus: number;
  auditStatus: OracleRequestAuditStatus;
  usedChainlink: boolean;
  flightId?: string | null;
  flightKey?: string | null;
  flightNumber?: string | null;
  flightStatus?: FlightStatus | null;
  latestNote?: string | null;
  outcome?: number | null;
  delayMinutes?: number | null;
  payoutEligible?: boolean | null;
  payoutExecuted?: boolean | null;
  payoutAmount?: string | null;
  transactionHash?: string | null;
  errorMessage?: string | null;
  metadata?: OracleAuditMetadata | null;
}) => {
  const auditRecord = await prisma.oracleRequestAudit.upsert({
    where: {
      chainId_policyId: {
        chainId: targetNetwork.id,
        policyId: params.policyId,
      },
    },
    create: {
      chainId: targetNetwork.id,
      policyId: params.policyId,
      requestId: params.requestId ?? null,
      chainlinkRequestId: params.chainlinkRequestId ?? null,
      flightKey: params.flightKey ?? null,
      requestStatus: params.requestStatus,
      auditStatus: params.auditStatus,
      usedChainlink: params.usedChainlink,
      flightId: params.flightId ?? null,
      flightNumber: params.flightNumber ?? null,
      flightStatus: params.flightStatus ?? null,
      latestNote: params.latestNote ?? null,
      outcome: params.outcome ?? null,
      delayMinutes: params.delayMinutes ?? null,
      payoutEligible: params.payoutEligible ?? null,
      payoutExecuted: params.payoutExecuted ?? null,
      payoutAmount: params.payoutAmount ?? null,
      transactionHash: params.transactionHash ?? null,
      errorMessage: params.errorMessage ?? null,
      metadata: params.metadata ?? undefined,
    },
    update: {
      requestId: params.requestId ?? null,
      chainlinkRequestId: params.chainlinkRequestId === undefined ? undefined : params.chainlinkRequestId,
      flightKey: params.flightKey ?? null,
      requestStatus: params.requestStatus,
      auditStatus: params.auditStatus,
      usedChainlink: params.usedChainlink,
      flightId: params.flightId ?? null,
      flightNumber: params.flightNumber ?? null,
      flightStatus: params.flightStatus ?? null,
      latestNote: params.latestNote ?? null,
      outcome: params.outcome ?? null,
      delayMinutes: params.delayMinutes ?? null,
      payoutEligible: params.payoutEligible ?? null,
      payoutExecuted: params.payoutExecuted ?? null,
      payoutAmount: params.payoutAmount ?? null,
      transactionHash: params.transactionHash ?? null,
      errorMessage: params.errorMessage ?? null,
      metadata: params.metadata ?? undefined,
    },
  });

  if (params.metadata === undefined) {
    return auditRecord;
  }

  const normalizedMetadata =
    params.metadata === null ? Prisma.DbNull : (JSON.parse(JSON.stringify(params.metadata)) as Prisma.InputJsonValue);

  await prisma.oracleRequestAudit.update({
    where: {
      chainId_policyId: {
        chainId: targetNetwork.id,
        policyId: params.policyId,
      },
    },
    data: {
      metadata: Prisma.DbNull,
    },
  });

  return prisma.oracleRequestAudit.update({
    where: {
      chainId_policyId: {
        chainId: targetNetwork.id,
        policyId: params.policyId,
      },
    },
    data: {
      metadata: normalizedMetadata,
    },
  });
};

const getRetryCount = async (policyId: bigint) => {
  const existingAudit = await prisma.oracleRequestAudit.findUnique({
    where: {
      chainId_policyId: {
        chainId: targetNetwork.id,
        policyId,
      },
    },
  });

  const metadata = existingAudit?.metadata as OracleAuditMetadata | null;
  return metadata?.retryCount ?? 0;
};

const compareSourcePriority = (leftId: string, rightId: string) => {
  const sourcePriority = ["flight_status_board", "latest_ops_update", "history_parser"];
  return sourcePriority.indexOf(leftId) - sourcePriority.indexOf(rightId);
};

const doesSourceSnapshotMatchFinalOutcome = (
  sources: OracleAuditMetadata["sources"] | undefined,
  finalOutcome: number,
  winningVotes?: number,
  totalVotes?: number,
) => {
  if (!sources?.length || !winningVotes || !totalVotes) {
    return false;
  }

  const outcomeVotes = new Map<number, NonNullable<OracleAuditMetadata["sources"]>>();

  for (const source of sources) {
    const existingVotes = outcomeVotes.get(source.outcome) ?? [];
    existingVotes.push(source);
    outcomeVotes.set(source.outcome, existingVotes);
  }

  const rankedOutcomes = [...outcomeVotes.entries()].sort((left, right) => {
    if (right[1].length !== left[1].length) {
      return right[1].length - left[1].length;
    }

    return compareSourcePriority(left[1][0]?.sourceId ?? "", right[1][0]?.sourceId ?? "");
  });

  const [winningOutcome, winningSources] = rankedOutcomes[0] ?? [];
  if (winningOutcome === undefined || !winningSources) {
    return false;
  }

  return winningOutcome === finalOutcome && winningSources.length === winningVotes && sources.length === totalVotes;
};

const getVoteSuffix = (winningVotes?: number, totalVotes?: number) => {
  if (!winningVotes || !totalVotes) {
    return "";
  }

  return ` Vote: ${winningVotes}/${totalVotes} sources agreed.`;
};

export const processDueOracleRequests = async (): Promise<OracleWorkerCycleResult> => {
  if (!policyManagerAddress || !oracleCoordinatorAddress || !chainlinkDemoOracleConsumerAddress) {
    throw new Error("Oracle contracts are not fully deployed for the configured target network.");
  }

  const walletClient = getWalletClient();
  const nextPolicyId = (await publicClient.readContract({
    address: policyManagerAddress,
    abi: policyManagerAbi,
    functionName: "nextPolicyId",
  })) as bigint;

  const result: OracleWorkerCycleResult = {
    scannedPolicies: 0,
    queuedPolicies: 0,
    requestedPolicies: 0,
    fulfilledPolicies: 0,
    failedPolicies: 0,
    expiredPolicies: 0,
  };

  for (let policyId = 1n; policyId < nextPolicyId; policyId++) {
    const policy = (await publicClient.readContract({
      address: policyManagerAddress,
      abi: policyManagerAbi,
      functionName: "getPolicy",
      args: [policyId],
    })) as PolicySnapshot;

    if (policy.policyId === 0n) {
      continue;
    }

    result.scannedPolicies += 1;

    const request = (await publicClient.readContract({
      address: oracleCoordinatorAddress,
      abi: oracleCoordinatorAbi,
      functionName: "requestsByPolicyId",
      args: [policyId],
    })) as OracleRequestState;

    const oracleReadyTimestamp = await getOracleReadyTimestamp(policyId, policy.departureTimestamp);
    const nowInSeconds = BigInt(Math.floor(Date.now() / 1000));

    if (request.fulfilled) {
      const existingAudit = await prisma.oracleRequestAudit.findUnique({
        where: {
          chainId_policyId: {
            chainId: targetNetwork.id,
            policyId,
          },
        },
      });
      const existingMetadata = (existingAudit?.metadata as OracleAuditMetadata | null) ?? null;
      const needsDecisionSnapshot =
        !existingAudit?.flightStatus ||
        !existingAudit?.latestNote ||
        existingAudit?.payoutEligible == null ||
        !existingMetadata?.sources?.length;
      const restoredDecision = needsDecisionSnapshot
        ? await getOracleDecisionForPolicy(policyId).catch(() => null)
        : null;
      const finalOutcome = request.outcome;
      const finalDelayMinutes = Number(request.delayMinutes);
      const finalPayoutEligible = isOracleDecisionPayoutEligible(policy, finalOutcome, finalDelayMinutes);
      const predictedOutcome = existingAudit?.outcome ?? restoredDecision?.oracle.outcome ?? null;
      const predictedDelayMinutes = existingAudit?.delayMinutes ?? restoredDecision?.oracle.delayMinutes ?? null;
      const predictedPayoutEligible = existingAudit?.payoutEligible ?? restoredDecision?.oracle.payoutEligible ?? null;
      const flightStatus =
        existingAudit?.flightStatus ?? (restoredDecision?.flight.currentStatus as FlightStatus | undefined) ?? null;
      const predictionMatchesFinalOutcome =
        predictedOutcome === finalOutcome &&
        predictedDelayMinutes === finalDelayMinutes &&
        (predictedPayoutEligible == null || predictedPayoutEligible === finalPayoutEligible);
      const trustedWinningVotes = predictionMatchesFinalOutcome
        ? (existingMetadata?.winningVotes ?? restoredDecision?.oracle.winningVotes)
        : undefined;
      const trustedTotalVotes = predictionMatchesFinalOutcome
        ? (existingMetadata?.totalVotes ?? restoredDecision?.oracle.totalVotes)
        : undefined;
      const candidateSources = existingMetadata?.sources ?? restoredDecision?.sources;
      const shouldKeepSourceSnapshot =
        predictionMatchesFinalOutcome &&
        doesSourceSnapshotMatchFinalOutcome(candidateSources, finalOutcome, trustedWinningVotes, trustedTotalVotes);
      const finalReason = predictionMatchesFinalOutcome
        ? (existingMetadata?.reason ??
          restoredDecision?.oracle.reason ??
          `${getOracleDecisionReason(policy, finalOutcome, finalDelayMinutes, flightStatus)}${getVoteSuffix(
            trustedWinningVotes,
            trustedTotalVotes,
          )}`)
        : getOracleDecisionReason(policy, finalOutcome, finalDelayMinutes, flightStatus);
      const finalMetadata: OracleAuditMetadata | undefined =
        existingMetadata || restoredDecision
          ? {
              requestTransactionHash: existingMetadata?.requestTransactionHash,
              callbackTransactionHash: existingMetadata?.callbackTransactionHash,
              oracleReadyTimestamp:
                existingMetadata?.oracleReadyTimestamp ?? restoredDecision?.policy.oracleReadyTimestamp,
              workerMode: existingMetadata?.workerMode,
              retryCount: existingMetadata?.retryCount,
              reason: finalReason,
              ...(shouldKeepSourceSnapshot
                ? {
                    sources: candidateSources,
                    winningVotes: trustedWinningVotes,
                    totalVotes: trustedTotalVotes,
                  }
                : {}),
            }
          : undefined;

      await upsertAuditRecord({
        policyId,
        requestId: request.requestId,
        chainlinkRequestId: existingAudit?.chainlinkRequestId ?? undefined,
        requestStatus: ORACLE_REQUEST_STATUS.FULFILLED,
        auditStatus: OracleRequestAuditStatus.FULFILLED,
        usedChainlink: existingAudit?.usedChainlink ?? false,
        flightId: existingAudit?.flightId ?? restoredDecision?.flight.id ?? null,
        flightKey:
          existingAudit?.flightKey ??
          (restoredDecision
            ? `${restoredDecision.policy.flightNumber}:${restoredDecision.policy.departureTimestamp}`
            : `${policy.flightNumber}:${policy.departureTimestamp.toString()}`),
        flightNumber: existingAudit?.flightNumber ?? restoredDecision?.flight.flightNumber ?? policy.flightNumber,
        flightStatus,
        latestNote: existingAudit?.latestNote ?? restoredDecision?.flight.latestNote ?? null,
        outcome: finalOutcome,
        delayMinutes: finalDelayMinutes,
        payoutEligible: finalPayoutEligible,
        payoutExecuted: request.payoutExecuted,
        payoutAmount: request.payoutAmount.toString(),
        transactionHash: existingAudit?.transactionHash ?? null,
        metadata: finalMetadata,
      });
      continue;
    }

    if (policy.status !== 0) {
      await upsertAuditRecord({
        policyId,
        requestId: request.requestId > 0n ? request.requestId : null,
        requestStatus: ORACLE_REQUEST_STATUS.EXPIRED,
        auditStatus: OracleRequestAuditStatus.EXPIRED,
        usedChainlink: false,
        flightKey: `${policy.flightNumber}:${policy.departureTimestamp.toString()}`,
        flightNumber: policy.flightNumber,
      });
      result.expiredPolicies += 1;
      continue;
    }

    if (nowInSeconds < oracleReadyTimestamp) {
      result.queuedPolicies += 1;
      continue;
    }

    let decisionSnapshot: Awaited<ReturnType<typeof getOracleDecisionForPolicy>> | null = null;
    let flightKey = `${policy.flightNumber}:${policy.departureTimestamp.toString()}`;
    let baseMetadata: OracleAuditMetadata | null = null;
    let requestTransactionHash: `0x${string}` | null = null;

    try {
      decisionSnapshot = await getOracleDecisionForPolicy(policyId);
      flightKey = `${decisionSnapshot.policy.flightNumber}:${decisionSnapshot.policy.departureTimestamp}`;
      baseMetadata = {
        sources: decisionSnapshot.sources,
        reason: decisionSnapshot.oracle.reason,
        winningVotes: decisionSnapshot.oracle.winningVotes,
        totalVotes: decisionSnapshot.oracle.totalVotes,
        oracleReadyTimestamp: decisionSnapshot.policy.oracleReadyTimestamp,
        workerMode: isChainlinkFunctionsEnabled ? "chainlink_functions_worker" : "simulated_consensus_worker",
      };

      let requestState = request;

      if (!requestState.pending && !requestState.fulfilled) {
        requestTransactionHash = await walletClient.writeContract({
          address: oracleCoordinatorAddress,
          abi: oracleCoordinatorAbi,
          functionName: "performUpkeep",
          args: [encodeAbiParameters([{ type: "uint256" }], [policyId])],
          chain: targetNetwork,
          account: walletClient.account,
        });

        await publicClient.waitForTransactionReceipt({ hash: requestTransactionHash });
        requestState = (await publicClient.readContract({
          address: oracleCoordinatorAddress,
          abi: oracleCoordinatorAbi,
          functionName: "requestsByPolicyId",
          args: [policyId],
        })) as OracleRequestState;

        await upsertAuditRecord({
          policyId,
          requestId: requestState.requestId,
          requestStatus: getRequestStatusCode(requestState),
          auditStatus: OracleRequestAuditStatus.AWAITING_CHAINLINK,
          usedChainlink: false,
          flightId: decisionSnapshot.flight.id,
          flightKey,
          flightNumber: decisionSnapshot.flight.flightNumber,
          flightStatus: decisionSnapshot.flight.currentStatus as FlightStatus,
          latestNote: decisionSnapshot.flight.latestNote,
          outcome: decisionSnapshot.oracle.outcome,
          delayMinutes: decisionSnapshot.oracle.delayMinutes,
          payoutEligible: decisionSnapshot.oracle.payoutEligible,
          transactionHash: requestTransactionHash,
          metadata: {
            ...baseMetadata,
            requestTransactionHash,
          },
        });

        result.requestedPolicies += 1;
      }

      if (isChainlinkFunctionsEnabled) {
        const activeChainlinkRequestId = (await publicClient.readContract({
          address: chainlinkDemoOracleConsumerAddress,
          abi: chainlinkDemoOracleConsumerAbi,
          functionName: "activeChainlinkRequestIdByPolicyId",
          args: [policyId],
        })) as `0x${string}`;

        let effectiveChainlinkRequestId = activeChainlinkRequestId;
        let chainlinkRequestTransactionHash: `0x${string}` | null = null;

        if (activeChainlinkRequestId === ZERO_BYTES32) {
          chainlinkRequestTransactionHash = await walletClient.writeContract({
            address: chainlinkDemoOracleConsumerAddress,
            abi: chainlinkDemoOracleConsumerAbi,
            functionName: "requestPolicyEvaluation",
            args: [policyId],
            chain: targetNetwork,
            account: walletClient.account,
          });

          await publicClient.waitForTransactionReceipt({ hash: chainlinkRequestTransactionHash });

          effectiveChainlinkRequestId = (await publicClient.readContract({
            address: chainlinkDemoOracleConsumerAddress,
            abi: chainlinkDemoOracleConsumerAbi,
            functionName: "activeChainlinkRequestIdByPolicyId",
            args: [policyId],
          })) as `0x${string}`;
        }

        await upsertAuditRecord({
          policyId,
          requestId: requestState.requestId,
          chainlinkRequestId: effectiveChainlinkRequestId === ZERO_BYTES32 ? null : effectiveChainlinkRequestId,
          requestStatus: getRequestStatusCode(requestState),
          auditStatus: OracleRequestAuditStatus.AWAITING_CHAINLINK,
          usedChainlink: true,
          flightId: decisionSnapshot.flight.id,
          flightKey,
          flightNumber: decisionSnapshot.flight.flightNumber,
          flightStatus: decisionSnapshot.flight.currentStatus as FlightStatus,
          latestNote: decisionSnapshot.flight.latestNote,
          outcome: decisionSnapshot.oracle.outcome,
          delayMinutes: decisionSnapshot.oracle.delayMinutes,
          payoutEligible: decisionSnapshot.oracle.payoutEligible,
          transactionHash: chainlinkRequestTransactionHash ?? requestTransactionHash ?? null,
          metadata: {
            ...baseMetadata,
            requestTransactionHash: requestTransactionHash ?? undefined,
          },
        });

        if (chainlinkRequestTransactionHash || requestTransactionHash) {
          result.requestedPolicies += 1;
        }
        continue;
      }

      const callbackTransactionHash = await walletClient.writeContract({
        address: chainlinkDemoOracleConsumerAddress,
        abi: chainlinkDemoOracleConsumerAbi,
        functionName: "submitConsensusResult",
        args: [policyId, decisionSnapshot.oracle.outcome, BigInt(decisionSnapshot.oracle.delayMinutes)],
        chain: targetNetwork,
        account: walletClient.account,
      });

      await publicClient.waitForTransactionReceipt({ hash: callbackTransactionHash });

      const finalRequestState = (await publicClient.readContract({
        address: oracleCoordinatorAddress,
        abi: oracleCoordinatorAbi,
        functionName: "requestsByPolicyId",
        args: [policyId],
      })) as OracleRequestState;

      await upsertAuditRecord({
        policyId,
        requestId: finalRequestState.requestId,
        requestStatus: ORACLE_REQUEST_STATUS.FULFILLED,
        auditStatus: OracleRequestAuditStatus.FULFILLED,
        usedChainlink: false,
        flightId: decisionSnapshot.flight.id,
        flightKey,
        flightNumber: decisionSnapshot.flight.flightNumber,
        flightStatus: decisionSnapshot.flight.currentStatus as FlightStatus,
        latestNote: decisionSnapshot.flight.latestNote,
        outcome: finalRequestState.outcome,
        delayMinutes: Number(finalRequestState.delayMinutes),
        payoutEligible: decisionSnapshot.oracle.payoutEligible,
        payoutExecuted: finalRequestState.payoutExecuted,
        payoutAmount: finalRequestState.payoutAmount.toString(),
        transactionHash: callbackTransactionHash,
        metadata: {
          ...baseMetadata,
          requestTransactionHash: requestTransactionHash ?? undefined,
          callbackTransactionHash,
        },
      });

      result.fulfilledPolicies += 1;
    } catch (error) {
      const retryCount = await getRetryCount(policyId);
      const rawMessage = error instanceof Error ? error.message : "Automatic oracle processing failed.";
      const message = formatOracleWorkerError(rawMessage) ?? rawMessage;

      await upsertAuditRecord({
        policyId,
        requestId: request.requestId > 0n ? request.requestId : null,
        requestStatus: ORACLE_REQUEST_STATUS.FAILED,
        auditStatus: OracleRequestAuditStatus.FAILED,
        usedChainlink: isChainlinkFunctionsEnabled,
        flightId: decisionSnapshot?.flight.id ?? null,
        flightKey,
        flightNumber: decisionSnapshot?.flight.flightNumber ?? policy.flightNumber,
        flightStatus: (decisionSnapshot?.flight.currentStatus as FlightStatus | undefined) ?? null,
        latestNote: decisionSnapshot?.flight.latestNote ?? null,
        outcome: decisionSnapshot?.oracle.outcome ?? null,
        delayMinutes: decisionSnapshot?.oracle.delayMinutes ?? null,
        payoutEligible: decisionSnapshot?.oracle.payoutEligible ?? null,
        transactionHash: requestTransactionHash,
        errorMessage: message,
        metadata: {
          ...(baseMetadata ?? {}),
          workerMode: isChainlinkFunctionsEnabled ? "chainlink_functions_worker" : "simulated_consensus_worker",
          retryCount: retryCount + 1,
        },
      });

      result.failedPolicies += 1;
    }
  }

  return result;
};
