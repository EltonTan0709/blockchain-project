export const formatFlightStatusLabel = (flightStatus: string | null | undefined) => {
  if (!flightStatus) {
    return "Unknown";
  }

  switch (flightStatus) {
    case "SCHEDULED":
      return "Scheduled";
    case "DELAYED":
      return "Delayed";
    case "CANCELLED":
      return "Cancelled";
    case "DEPARTED":
      return "Departed";
    case "ARRIVED":
      return "Arrived";
    default:
      return flightStatus;
  }
};

const CHAINLINK_ERROR_OVERRIDES: Array<{ match: string; message: string }> = [
  {
    match: "0xf4d678b8",
    message:
      "Chainlink Functions could not create the request because the subscription balance is too low. Top up the subscription with LINK and let the worker retry.",
  },
  {
    match: "0x71e83137",
    message:
      "Chainlink Functions rejected this consumer contract. Add the current consumer address to the subscription and retry.",
  },
  {
    match: "0x1f6a65b6",
    message: "Chainlink Functions rejected the configured subscription ID. Check the subscription ID and retry.",
  },
  {
    match: "Policy not found on-chain.",
    message:
      "The public oracle API is still pointing at older contract addresses. Redeploy the frontend or update the runtime contract address overrides.",
  },
];

export const formatOracleWorkerError = (errorMessage: string | null | undefined) => {
  if (!errorMessage) {
    return null;
  }

  const matchedOverride = CHAINLINK_ERROR_OVERRIDES.find(override => errorMessage.includes(override.match));
  if (matchedOverride) {
    return matchedOverride.message;
  }

  return errorMessage
    .replace(/\s+Docs:\s+https:\/\/viem\.sh\/docs\/contract\/decodeErrorResult/gi, "")
    .replace(/\s+Version:\s+viem@[^\s]+/gi, "")
    .trim();
};

const getFallbackOutcomeLabel = (flightStatus: string | null | undefined) => {
  switch (flightStatus) {
    case "SCHEDULED":
      return "Scheduled";
    case "DELAYED":
      return "Delayed";
    case "CANCELLED":
      return "Cancelled";
    case "DEPARTED":
    case "ARRIVED":
      return "No disruption";
    default:
      return null;
  }
};

export const getOutcomeLabel = (
  outcome: number | null | undefined,
  flightStatus?: string | null,
  unresolvedLabel = "Unresolved",
) => {
  switch (outcome) {
    case 1:
      return "On Time";
    case 2:
      return "Delayed";
    case 3:
      return "Cancelled";
    default:
      return getFallbackOutcomeLabel(flightStatus) ?? unresolvedLabel;
  }
};
