export type DisplayPolicyStatus = "Pending" | "Expired" | "Claimed" | "Paid Out" | "Unknown";

export const getPolicyTypeText = (policyType: number) => {
  switch (policyType) {
    case 0:
      return "Flight Delay";
    case 1:
      return "Flight Cancellation";
    default:
      return "Unknown";
  }
};

export const getContractStatusText = (status: number) => {
  switch (status) {
    case 0:
      return "Active";
    case 1:
      return "Expired";
    case 2:
      return "Claimed";
    case 3:
      return "PaidOut";
    default:
      return "Unknown";
  }
};

export const getDisplayPolicyStatus = (status: number, endTime: bigint) => {
  const now = Math.floor(Date.now() / 1000);

  if (status === 3) return "Paid Out";
  if (status === 2) return "Claimed";
  if (status === 1) return "Expired";

  if (status === 0) {
    return Number(endTime) < now ? "Expired" : "Pending";
  }

  return "Unknown";
};

export const getStatusBadgeClass = (displayStatus: DisplayPolicyStatus) => {
  switch (displayStatus) {
    case "Pending":
      return "badge badge-warning";
    case "Expired":
      return "badge badge-neutral";
    case "Claimed":
      return "badge badge-info";
    case "Paid Out":
      return "badge badge-success";
    default:
      return "badge badge-ghost";
  }
};

export const formatUnixTimestamp = (timestamp: bigint) => {
  const value = Number(timestamp);
  if (!value) return "—";
  return new Date(value * 1000).toLocaleString();
};
