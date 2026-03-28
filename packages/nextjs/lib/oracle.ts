import "server-only";
import { createPublicClient, http } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import { getFlightByFlightNumber } from "~~/lib/flights";
import scaffoldConfig from "~~/scaffold.config";
import { CONTRACTS } from "~~/utils/scaffold-eth/contract";
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

const targetNetwork = scaffoldConfig.targetNetworks[0];
const rpcOverrides = scaffoldConfig.rpcOverrides as Record<number, string> | undefined;
const fallbackRpcUrl =
  rpcOverrides?.[targetNetwork.id] ?? getAlchemyHttpUrl(targetNetwork.id) ?? targetNetwork.rpcUrls.default.http[0];

const publicClient = createPublicClient({
  chain: targetNetwork,
  transport: http(fallbackRpcUrl),
});

const deployedPolicyManagerAddress = (deployedContracts as Record<number, { PolicyManager?: { address: string } }>)[
  targetNetwork.id
]?.PolicyManager?.address;

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

const getReason = (policy: PolicySnapshot, oracleOutcome: number, delayMinutes: number) => {
  if (oracleOutcome === 0) {
    return "Flight data is still unresolved in Postgres.";
  }

  if (policy.policyType === 0) {
    if (oracleOutcome !== 2) {
      return "Policy is a delay cover, but the flight is not marked delayed.";
    }

    if (delayMinutes < Number(policy.delayThresholdMinutes)) {
      return `Delay is ${delayMinutes} minutes, below the ${Number(policy.delayThresholdMinutes)} minute threshold.`;
    }

    return "Delay threshold met. Policy should pay out.";
  }

  if (oracleOutcome === 3) {
    return "Flight is cancelled. Policy should pay out.";
  }

  return "Policy is a cancellation cover, but the flight is not marked cancelled.";
};

export const getOracleDecisionForPolicy = async (policyId: bigint) => {
  const policy = (await publicClient.readContract({
    address: (deployedPolicyManagerAddress ?? CONTRACTS.PolicyManager) as `0x${string}`,
    abi: policyManagerAbi,
    functionName: "getPolicy",
    args: [policyId],
  })) as PolicySnapshot;

  if (policy.policyId === 0n) {
    throw new Error("Policy not found on-chain.");
  }

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

  const latestStatusUpdate = matchedFlight.statusUpdates[0];
  const delayMinutes = parseDelayMinutes(latestStatusUpdate?.note);
  const oracleOutcome = toOracleOutcome(matchedFlight.currentStatus);
  const payoutEligible =
    policy.policyType === 0
      ? oracleOutcome === 2 && delayMinutes >= Number(policy.delayThresholdMinutes)
      : oracleOutcome === 3;

  return {
    policy: {
      policyId: policy.policyId.toString(),
      holder: policy.holder,
      flightNumber: policy.flightNumber,
      purchaseTime: policy.purchaseTime.toString(),
      departureTimestamp: policy.departureTimestamp.toString(),
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
    },
    oracle: {
      outcome: oracleOutcome,
      delayMinutes,
      payoutEligible,
      reason: getReason(policy, oracleOutcome, delayMinutes),
    },
  };
};
