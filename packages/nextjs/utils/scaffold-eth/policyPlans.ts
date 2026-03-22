export type PolicyPlan = {
  id: string;
  title: string;
  description: string;
  policyType: 0 | 1;
  coverage: string;
  premium: string;
  duration: string;
  delayThresholdHours?: string;
};

export const POLICY_PLANS: PolicyPlan[] = [
  {
    id: "delay-basic",
    title: "Flight Delay Basic",
    description: "Pays out automatically if your flight delay exceeds the threshold.",
    policyType: 0,
    coverage: "100",
    premium: "10",
    duration: "24",
    delayThresholdHours: "6",
  },
  {
    id: "delay-plus",
    title: "Flight Delay Plus",
    description: "Higher payout for travelers who want stronger delay protection.",
    policyType: 0,
    coverage: "250",
    premium: "20",
    duration: "24",
    delayThresholdHours: "12",
  },
  {
    id: "cancel-basic",
    title: "Flight Cancellation Basic",
    description: "Pays out automatically if your flight is cancelled.",
    policyType: 1,
    coverage: "200",
    premium: "15",
    duration: "48",
  },
  {
    id: "cancel-premium",
    title: "Flight Cancellation Premium",
    description: "Higher cancellation payout for greater peace of mind.",
    policyType: 1,
    coverage: "500",
    premium: "35",
    duration: "48",
  },
];

export const getPolicyTypeLabel = (policyType: number) => {
  switch (policyType) {
    case 0:
      return "Flight Delay";
    case 1:
      return "Flight Cancellation";
    default:
      return "Unknown";
  }
};

export const getTriggerLabel = (plan: PolicyPlan) => {
  if (plan.policyType === 0) {
    return `Delay > ${plan.delayThresholdHours ?? "N/A"} hours`;
  }
  if (plan.policyType === 1) {
    return "Flight cancelled";
  }
  return "Unknown trigger";
};
