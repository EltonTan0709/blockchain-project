import { createPublicClient, http } from "viem";
import { getFlightByFlightNumber } from "~~/lib/flights";
import { getRuntimeContractAddresses } from "~~/lib/runtime-contract-addresses";
import scaffoldConfig from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth/networks";

const policyManagerAbi = [
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

type OracleSourceDecision = {
  sourceId: string;
  sourceLabel: string;
  outcome: number;
  delayMinutes: number;
  payoutEligible: boolean;
  reason: string;
};

type OracleDecisionPolicyLike = Pick<PolicySnapshot, "policyType" | "delayThresholdMinutes">;

const targetNetwork = scaffoldConfig.targetNetworks[0];
const rpcOverrides = scaffoldConfig.rpcOverrides as Record<number, string> | undefined;
const fallbackRpcUrl =
  rpcOverrides?.[targetNetwork.id] ?? getAlchemyHttpUrl(targetNetwork.id) ?? targetNetwork.rpcUrls.default.http[0];

const publicClient = createPublicClient({
  chain: targetNetwork,
  transport: http(fallbackRpcUrl),
});

const parseDelayMinutes = (note: string | null | undefined) => {
  if (!note) {
    return 0;
  }

  const minutesMatch = note.match(/(\d+)\s*minute/i);
  if (minutesMatch) {
    return Number(minutesMatch[1]);
  }

  const hoursMatch = note.match(/(\d+)\s*hour/i);
  if (hoursMatch) {
    return Number(hoursMatch[1]) * 60;
  }

  return 0;
};

const toOracleOutcome = (status: string) => {
  switch (status) {
    case "DELAYED":
      return 2;
    case "CANCELLED":
      return 3;
    case "DEPARTED":
    case "ARRIVED":
      return 1;
    default:
      return 0;
  }
};

export const isOracleDecisionPayoutEligible = (
  policy: OracleDecisionPolicyLike,
  oracleOutcome: number,
  delayMinutes: number,
) => {
  return policy.policyType === 0
    ? oracleOutcome === 2 && delayMinutes >= Number(policy.delayThresholdMinutes)
    : oracleOutcome === 3;
};

export const getOracleDecisionReason = (
  policy: OracleDecisionPolicyLike,
  oracleOutcome: number,
  delayMinutes: number,
  flightStatus?: string | null,
) => {
  if (oracleOutcome === 0) {
    if (flightStatus === "SCHEDULED") {
      return "Flight record exists in Postgres, but it is still scheduled and no qualifying disruption has been recorded.";
    }

    return "Flight record exists in Postgres, but the outcome is still unresolved.";
  }

  if (policy.policyType === 0) {
    if (oracleOutcome !== 2) {
      return "Policy is a delay cover, but the voted oracle outcome is not delayed.";
    }

    if (delayMinutes < Number(policy.delayThresholdMinutes)) {
      return `Voted delay is ${delayMinutes} minutes, below the ${Number(policy.delayThresholdMinutes)} minute threshold.`;
    }

    return "Majority vote confirms the delay threshold has been met.";
  }

  if (oracleOutcome === 3) {
    return "Majority vote confirms the flight is cancelled.";
  }

  return "Policy is a cancellation cover, but the voted oracle outcome is not cancelled.";
};

const getMedianDelay = (delays: number[]) => {
  if (delays.length === 0) {
    return 0;
  }

  const sortedDelays = [...delays].sort((left, right) => left - right);
  return sortedDelays[Math.floor(sortedDelays.length / 2)];
};

const compareSourcePriority = (leftId: string, rightId: string) => {
  const sourcePriority = ["flight_status_board", "latest_ops_update", "history_parser"];
  return sourcePriority.indexOf(leftId) - sourcePriority.indexOf(rightId);
};

const buildSourceDecisions = (
  policy: PolicySnapshot,
  flight: Awaited<ReturnType<typeof getFlightByFlightNumber>>[number],
): OracleSourceDecision[] => {
  const latestStatusUpdate = flight.statusUpdates[0];
  const latestNoteDelay = parseDelayMinutes(latestStatusUpdate?.note);
  const historicalStatuses = flight.statusUpdates.map(statusUpdate => statusUpdate.status);
  const historicalDelayMinutes = flight.statusUpdates
    .filter(statusUpdate => statusUpdate.status === "DELAYED")
    .map(statusUpdate => parseDelayMinutes(statusUpdate.note))
    .filter(delayMinutes => delayMinutes > 0);
  const hasArrivedOrDepartedHistory = historicalStatuses.some(status => status === "DEPARTED" || status === "ARRIVED");

  let historyOutcome = 0;
  if (historicalStatuses.includes("CANCELLED")) {
    historyOutcome = 3;
  } else if (historicalStatuses.includes("DELAYED") || flight.currentStatus === "DELAYED") {
    historyOutcome = 2;
  } else if (hasArrivedOrDepartedHistory || flight.currentStatus === "DEPARTED" || flight.currentStatus === "ARRIVED") {
    historyOutcome = 1;
  }

  const sourceDecisions: OracleSourceDecision[] = [
    {
      sourceId: "flight_status_board",
      sourceLabel: "Flight Status Board",
      outcome: toOracleOutcome(flight.currentStatus),
      delayMinutes: latestNoteDelay,
      payoutEligible: isOracleDecisionPayoutEligible(policy, toOracleOutcome(flight.currentStatus), latestNoteDelay),
      reason: "Uses the canonical Flight.currentStatus record plus the latest operator note.",
    },
    {
      sourceId: "latest_ops_update",
      sourceLabel: "Latest Ops Update",
      outcome: toOracleOutcome(latestStatusUpdate?.status ?? flight.currentStatus),
      delayMinutes: parseDelayMinutes(latestStatusUpdate?.note),
      payoutEligible: isOracleDecisionPayoutEligible(
        policy,
        toOracleOutcome(latestStatusUpdate?.status ?? flight.currentStatus),
        parseDelayMinutes(latestStatusUpdate?.note),
      ),
      reason: "Uses only the most recent FlightStatusUpdate submitted by operations.",
    },
    {
      sourceId: "history_parser",
      sourceLabel: "History Parser",
      outcome: historyOutcome,
      delayMinutes: historyOutcome === 2 ? Math.max(...historicalDelayMinutes, latestNoteDelay, 0) : 0,
      payoutEligible: isOracleDecisionPayoutEligible(
        policy,
        historyOutcome,
        historyOutcome === 2 ? Math.max(...historicalDelayMinutes, latestNoteDelay, 0) : 0,
      ),
      reason:
        "Scans status history and note-derived delay evidence, then chooses the most severe supported disruption.",
    },
  ];

  return sourceDecisions;
};

export const getOracleDecisionForPolicy = async (policyId: bigint) => {
  const { policyManagerAddress } = getRuntimeContractAddresses();
  const policy = (await publicClient.readContract({
    address: policyManagerAddress,
    abi: policyManagerAbi,
    functionName: "getPolicy",
    args: [policyId],
  })) as PolicySnapshot;

  if (policy.policyId === 0n) {
    throw new Error("Policy not found on-chain.");
  }

  const oracleReadyTimestamp = await publicClient
    .readContract({
      address: policyManagerAddress,
      abi: policyManagerAbi,
      functionName: "getOracleReadyTimestamp",
      args: [policyId],
    })
    .catch(() => policy.departureTimestamp);

  const matchingFlights = await getFlightByFlightNumber(policy.flightNumber);
  if (matchingFlights.length === 0) {
    throw new Error("No matching flight found in Postgres.");
  }

  const targetDepartureMs = Number(policy.departureTimestamp) * 1000;
  const matchedFlight = matchingFlights
    .slice()
    .sort(
      (left, right) =>
        Math.abs(new Date(left.scheduledDeparture).getTime() - targetDepartureMs) -
        Math.abs(new Date(right.scheduledDeparture).getTime() - targetDepartureMs),
    )[0];

  const sourceDecisions = buildSourceDecisions(policy, matchedFlight);
  const outcomeVotes = new Map<number, OracleSourceDecision[]>();

  for (const sourceDecision of sourceDecisions) {
    const existingVotes = outcomeVotes.get(sourceDecision.outcome) ?? [];
    existingVotes.push(sourceDecision);
    outcomeVotes.set(sourceDecision.outcome, existingVotes);
  }

  const rankedOutcomes = [...outcomeVotes.entries()].sort((left, right) => {
    if (right[1].length !== left[1].length) {
      return right[1].length - left[1].length;
    }

    return compareSourcePriority(left[1][0]?.sourceId ?? "", right[1][0]?.sourceId ?? "");
  });

  const [winningOutcome, winningSources] = rankedOutcomes[0];
  const consensusDelayMinutes =
    winningOutcome === 2 ? getMedianDelay(winningSources.map(source => source.delayMinutes)) : 0;
  const payoutEligible = isOracleDecisionPayoutEligible(policy, winningOutcome, consensusDelayMinutes);
  const baseReason = getOracleDecisionReason(
    policy,
    winningOutcome,
    consensusDelayMinutes,
    matchedFlight.currentStatus,
  );
  const latestStatusUpdate = matchedFlight.statusUpdates[0];

  return {
    policy: {
      policyId: policy.policyId.toString(),
      holder: policy.holder,
      flightNumber: policy.flightNumber,
      purchaseTime: policy.purchaseTime.toString(),
      departureTimestamp: policy.departureTimestamp.toString(),
      oracleReadyTimestamp: oracleReadyTimestamp.toString(),
      premium: policy.premium.toString(),
      coverageAmount: policy.coverageAmount.toString(),
      endTime: policy.endTime.toString(),
      delayThresholdMinutes: policy.delayThresholdMinutes.toString(),
      policyType: Number(policy.policyType),
      status: Number(policy.status),
    },
    flight: {
      id: matchedFlight.id,
      flightNumber: matchedFlight.flightNumber,
      currentStatus: matchedFlight.currentStatus,
      scheduledDeparture: matchedFlight.scheduledDeparture.toISOString(),
      latestNote: latestStatusUpdate?.note ?? null,
      statusUpdatesCount: matchedFlight.statusUpdates.length,
    },
    sources: sourceDecisions,
    oracle: {
      outcome: winningOutcome,
      delayMinutes: consensusDelayMinutes,
      payoutEligible,
      reason: `${baseReason} Vote: ${winningSources.length}/${sourceDecisions.length} sources agreed.`,
      winningVotes: winningSources.length,
      totalVotes: sourceDecisions.length,
    },
  };
};
