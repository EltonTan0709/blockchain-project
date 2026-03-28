"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatUnits, parseUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  MagnifyingGlassCircleIcon,
} from "@heroicons/react/24/solid";
import deployedContracts from "~~/contracts/deployedContracts";
import { notification } from "~~/utils/scaffold-eth";
import { CONTRACTS } from "~~/utils/scaffold-eth/contract";
import { POLICY_PLANS, getPolicyTypeLabel, getTriggerLabel } from "~~/utils/scaffold-eth/policyPlans";

const mockUsdcAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const policyManagerAbi = [
  {
    type: "function",
    name: "buyPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "flightNumber", type: "string" },
      { name: "departureTimestamp", type: "uint256" },
      { name: "policyType", type: "uint8" },
      { name: "coverageAmount", type: "uint256" },
      { name: "duration", type: "uint256" },
      { name: "delayThresholdMinutes", type: "uint256" },
      { name: "premium", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const POLICY_TYPE_OPTIONS = [
  { label: "Flight Delay", value: 0 },
  { label: "Flight Cancellation", value: 1 },
] as const;

const HOURS_IN_SECONDS = 3600;

type FlightLookupResponse = {
  data: Array<{
    id: string;
    flightNumber: string;
    scheduledDeparture: string;
  }>;
};

const formatDateTimeUtcValue = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
};

const parseUtcDateTimeValue = (value: string) => {
  if (!value) {
    return Number.NaN;
  }

  return Date.parse(`${value}:00Z`);
};

const getLookupTone = (message: string) => {
  if (!message) {
    return "text-base-content/70";
  }

  if (message.includes("auto-filled")) {
    return "text-success";
  }

  return "text-warning";
};

export const BuyPolicyForm = () => {
  const searchParams = useSearchParams();
  const { address, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const chainId = chain?.id as keyof typeof deployedContracts | undefined;
  const chainContracts = chainId
    ? ((deployedContracts as Record<number, { MockUSDC?: { address: string }; PolicyManager?: { address: string } }>)[
        Number(chainId)
      ] ?? undefined)
    : undefined;

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [departureDateTime, setDepartureDateTime] = useState("");
  const [policyType, setPolicyType] = useState(0);
  const [coverageAmount, setCoverageAmount] = useState("100");
  const [durationHours, setDurationHours] = useState("24");
  const [delayThresholdHours, setDelayThresholdHours] = useState("0");
  const [premium, setPremium] = useState("10");
  const [isApproving, setIsApproving] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [isLookingUpFlight, setIsLookingUpFlight] = useState(false);
  const [flightLookupMessage, setFlightLookupMessage] = useState("");
  const [debouncedFlightNumber, setDebouncedFlightNumber] = useState("");

  const MOCK_USDC_ADDRESS =
    (chainContracts?.MockUSDC?.address as `0x${string}` | undefined) ?? (CONTRACTS.MockUSDC as `0x${string}`);
  const POLICY_MANAGER_ADDRESS =
    (chainContracts?.PolicyManager?.address as `0x${string}` | undefined) ?? (CONTRACTS.PolicyManager as `0x${string}`);
  const TOKEN_DECIMALS = CONTRACTS.TOKEN_DECIMALS;

  useEffect(() => {
    const planIdParam = searchParams.get("planId");
    const policyTypeParam = searchParams.get("policyType");
    const coverageParam = searchParams.get("coverage");
    const premiumParam = searchParams.get("premium");
    const durationParam = searchParams.get("duration");
    const delayThresholdParam = searchParams.get("delayThresholdHours");

    if (planIdParam) {
      setSelectedPlanId(planIdParam);
    }

    if (policyTypeParam !== null) {
      const parsedPolicyType = Number(policyTypeParam);
      if (!Number.isNaN(parsedPolicyType)) {
        setPolicyType(parsedPolicyType);
      }
    }

    if (coverageParam !== null) {
      setCoverageAmount(coverageParam);
    }

    if (premiumParam !== null) {
      setPremium(premiumParam);
    }

    if (durationParam !== null) {
      setDurationHours(durationParam);
    }

    if (delayThresholdParam !== null) {
      setDelayThresholdHours(delayThresholdParam || "0");
    }
  }, [searchParams]);

  useEffect(() => {
    const trimmedFlightNumber = flightNumber.trim().toUpperCase();
    const debounceTimeout = setTimeout(() => {
      setDebouncedFlightNumber(trimmedFlightNumber);
    }, 1000);

    return () => clearTimeout(debounceTimeout);
  }, [flightNumber]);

  useEffect(() => {
    const normalizedFlightNumber = flightNumber.trim().toUpperCase();

    if (!normalizedFlightNumber) {
      setFlightLookupMessage("");
      setDepartureDateTime("");
      return;
    }

    if (normalizedFlightNumber.length < 3) {
      setFlightLookupMessage("Enter at least 3 characters to search for a flight.");
      setDepartureDateTime("");
      return;
    }
  }, [flightNumber]);

  useEffect(() => {
    const normalizedFlightNumber = debouncedFlightNumber;

    if (!normalizedFlightNumber || normalizedFlightNumber.length < 3) {
      return;
    }

    let isCancelled = false;

    const lookupFlight = async () => {
      try {
        setIsLookingUpFlight(true);
        setFlightLookupMessage("");

        const response = await fetch(`/api/flights/by-number/${encodeURIComponent(normalizedFlightNumber)}`, {
          cache: "no-store",
        });

        const payload = (await response.json()) as FlightLookupResponse | { error?: string };

        if (!response.ok || !("data" in payload)) {
          throw new Error("error" in payload ? payload.error : "Failed to load flight details.");
        }

        if (isCancelled) {
          return;
        }

        if (payload.data.length === 0) {
          setDepartureDateTime("");
          setFlightLookupMessage("No matching flight was found for this number.");
          return;
        }

        const now = Date.now();
        const upcomingFlight =
          payload.data
            .filter(flight => new Date(flight.scheduledDeparture).getTime() >= now)
            .sort(
              (left, right) =>
                new Date(left.scheduledDeparture).getTime() - new Date(right.scheduledDeparture).getTime(),
            )[0] ?? payload.data[0];

        setDepartureDateTime(formatDateTimeUtcValue(upcomingFlight.scheduledDeparture));
        setFlightLookupMessage(
          new Date(upcomingFlight.scheduledDeparture).getTime() >= now
            ? "Departure date and time auto-filled from flight records in UTC."
            : "Latest matching flight found, but its departure time is already in the past.",
        );
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setDepartureDateTime("");
        setFlightLookupMessage(error instanceof Error ? error.message : "Failed to load flight details.");
      } finally {
        if (!isCancelled) {
          setIsLookingUpFlight(false);
        }
      }
    };

    void lookupFlight();

    return () => {
      isCancelled = true;
    };
  }, [debouncedFlightNumber]);

  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return null;
    return POLICY_PLANS.find(plan => plan.id === selectedPlanId) ?? null;
  }, [selectedPlanId]);

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

    setPolicyType(selectedPlan.policyType);
    setCoverageAmount(selectedPlan.coverage);
    setDurationHours(selectedPlan.duration);
    setPremium(selectedPlan.premium);

    if (selectedPlan.policyType === 0) {
      setDelayThresholdHours(currentValue => currentValue || selectedPlan.delayThresholdHours || "0");
    } else {
      setDelayThresholdHours("0");
    }
  }, [selectedPlan]);

  const departureTimestamp = useMemo(() => {
    if (!departureDateTime) return 0;
    const ms = parseUtcDateTimeValue(departureDateTime);
    if (Number.isNaN(ms)) return 0;
    return Math.floor(ms / 1000);
  }, [departureDateTime]);

  const coverageAmountParsed = useMemo(() => {
    try {
      return parseUnits(coverageAmount || "0", TOKEN_DECIMALS);
    } catch {
      return undefined;
    }
  }, [coverageAmount, TOKEN_DECIMALS]);

  const premiumParsed = useMemo(() => {
    try {
      return parseUnits(premium || "0", TOKEN_DECIMALS);
    } catch {
      return undefined;
    }
  }, [premium, TOKEN_DECIMALS]);

  const durationParsed = useMemo(() => {
    const hours = Number(durationHours || "0");
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    return Math.floor(hours * HOURS_IN_SECONDS);
  }, [durationHours]);

  const delayThresholdMinutesParsed = useMemo(() => {
    const hours = Number(delayThresholdHours || "0");
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    return Math.floor(hours * 60);
  }, [delayThresholdHours]);

  const currentUnixTime = Math.floor(Date.now() / 1000);

  const isAbiReady = !!chainContracts?.MockUSDC?.address && !!chainContracts?.PolicyManager?.address;
  const isFlightNumberValid = flightNumber.trim().length > 0;
  const isDepartureValid = departureTimestamp > currentUnixTime;
  const isCoverageValid = coverageAmountParsed !== undefined && Number(coverageAmount) > 0;
  const isPremiumValid = premiumParsed !== undefined && Number(premium) > 0;
  const isDurationValid = durationParsed > 0;
  const isDelayThresholdValid = policyType === 1 || delayThresholdMinutesParsed > 0;

  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: mockUsdcAbi,
    functionName: "allowance",
    args: address ? [address, POLICY_MANAGER_ADDRESS] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const balanceDisplay = typeof usdcBalance === "bigint" ? formatUnits(usdcBalance, TOKEN_DECIMALS) : "—";
  const allowanceDisplay = typeof allowance === "bigint" ? formatUnits(allowance, TOKEN_DECIMALS) : "—";

  const allowanceBigInt = typeof allowance === "bigint" ? allowance : 0n;
  const hasEnoughAllowance = !!premiumParsed && allowanceBigInt >= premiumParsed;

  const canApprove = isAbiReady && isPremiumValid && !hasEnoughAllowance && !isApproving;

  const canBuy =
    !!policyManagerAbi &&
    isFlightNumberValid &&
    isDepartureValid &&
    isCoverageValid &&
    isPremiumValid &&
    isDurationValid &&
    isDelayThresholdValid &&
    hasEnoughAllowance &&
    !isBuying;

  const purchaseChecklist = [
    {
      label: "Flight number entered",
      detail: flightNumber.trim() || "Add a valid flight code to begin lookup.",
      isComplete: isFlightNumberValid,
    },
    {
      label: "Departure time confirmed",
      detail: isDepartureValid
        ? "A future departure has been locked in from flight data."
        : "Waiting for a future flight departure.",
      isComplete: isDepartureValid,
    },
    {
      label: "Coverage amount ready",
      detail: `${coverageAmount || "0"} USDC coverage selected`,
      isComplete: isCoverageValid,
    },
    {
      label: "Premium ready",
      detail: `${premium || "0"} USDC premium configured`,
      isComplete: isPremiumValid,
    },
    {
      label: "Policy window set",
      detail: `${durationHours || "0"} hours of protection`,
      isComplete: isDurationValid,
    },
    {
      label: "Delay trigger configured",
      detail:
        policyType === 0
          ? `${delayThresholdHours || "0"} hours threshold selected`
          : "Not required for cancellation cover.",
      isComplete: isDelayThresholdValid,
    },
    {
      label: "Allowance approved",
      detail: hasEnoughAllowance ? "Wallet allowance covers the premium." : "Approve MockUSDC before purchase.",
      isComplete: hasEnoughAllowance,
    },
    {
      label: "Contract connection loaded",
      detail: isAbiReady ? "Contracts are connected and ready." : "Waiting for contract metadata.",
      isComplete: isAbiReady,
    },
  ];

  const refreshTokenState = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await refetchAllowance();
    await refetchUsdcBalance();
  };

  const resetForm = () => {
    setFlightNumber("");
    setDepartureDateTime("");

    if (selectedPlan) {
      setPolicyType(selectedPlan.policyType);
      setCoverageAmount(selectedPlan.coverage);
      setDurationHours(selectedPlan.duration);
      setDelayThresholdHours(selectedPlan.delayThresholdHours ?? "0");
      setPremium(selectedPlan.premium);
    } else {
      setPolicyType(0);
      setCoverageAmount("100");
      setDurationHours("24");
      setDelayThresholdHours("0");
      setPremium("10");
    }
  };

  const handleApprove = async () => {
    if (!premiumParsed) {
      notification.error("Missing contract configuration or invalid premium.");
      return;
    }

    try {
      setIsApproving(true);

      const txHash = await writeContractAsync({
        address: MOCK_USDC_ADDRESS,
        abi: mockUsdcAbi,
        functionName: "approve",
        args: [POLICY_MANAGER_ADDRESS, premiumParsed],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      await refreshTokenState();
      notification.success("USDC approved successfully.");
    } catch (error: any) {
      notification.error(error?.shortMessage || error?.message || "Approve failed.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleBuyPolicy = async () => {
    if (!coverageAmountParsed || !premiumParsed) {
      notification.error("Missing contract configuration or invalid inputs.");
      return;
    }

    if (!isDelayThresholdValid) {
      notification.error("Delay plans require a valid delay threshold before purchase.");
      return;
    }

    try {
      setIsBuying(true);

      const txHash = await writeContractAsync({
        address: POLICY_MANAGER_ADDRESS,
        abi: policyManagerAbi,
        functionName: "buyPolicy",
        args: [
          flightNumber.trim(),
          BigInt(departureTimestamp),
          policyType,
          coverageAmountParsed,
          BigInt(durationParsed),
          BigInt(delayThresholdMinutesParsed),
          premiumParsed,
        ],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      await refreshTokenState();
      resetForm();

      notification.success("Policy purchased successfully.");
    } catch (error: any) {
      notification.error(error?.shortMessage || error?.message || "Policy purchase failed.");
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {isLookingUpFlight && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-base-content/20 backdrop-blur-sm">
          <div className="pointer-events-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-primary/20 bg-base-100 p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MagnifyingGlassCircleIcon className="h-10 w-10 animate-pulse" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">Searching Flight Records</h2>
            <p className="mt-2 text-sm text-base-content/70">
              We&apos;re checking the latest flight details and locking the departure time for your policy.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3 text-primary">
              <span className="loading loading-spinner loading-md" />
              <span className="font-medium">Looking up {flightNumber.trim() || "flight details"}...</span>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[2rem] border border-base-300 bg-base-100 shadow-2xl">
        <div className="bg-gradient-to-r from-primary/12 via-base-100 to-secondary/10 px-8 py-7">
          <h1 className="text-3xl font-bold">Buy Flight Insurance</h1>
          <p className="mt-2 max-w-2xl text-base-content/70">
            Protect your trip against flight delays and cancellations using MockUSDC.
          </p>
        </div>

        {selectedPlan && (
          <div className="mx-8 mt-6 rounded-3xl border border-primary/20 bg-primary/10 p-5">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Selected Plan</div>
            <div className="mt-2 text-lg font-bold">{selectedPlan.title}</div>
            <div className="mt-1 text-sm text-base-content/70">{selectedPlan.description}</div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
              <div>
                <span className="font-semibold">Type:</span> {getPolicyTypeLabel(selectedPlan.policyType)}
              </div>
              <div>
                <span className="font-semibold">Coverage:</span> {selectedPlan.coverage} USDC
              </div>
              <div>
                <span className="font-semibold">Premium:</span> {selectedPlan.premium} USDC
              </div>
              <div>
                <span className="font-semibold">Trigger:</span> {getTriggerLabel(selectedPlan)}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 px-8 py-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.9fr)]">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">Flight Number</label>
                <label className="input input-bordered flex h-16 items-center gap-3 rounded-2xl px-4 focus-within:border-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/20">
                  <MagnifyingGlassCircleIcon className="h-6 w-6 text-primary" />
                  <input
                    type="text"
                    value={flightNumber}
                    onChange={e => setFlightNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. SQ318"
                    className="w-full bg-transparent text-lg font-medium outline-none"
                  />
                </label>
                <div className={`mt-3 flex items-center gap-2 text-sm ${getLookupTone(flightLookupMessage)}`}>
                  {isLookingUpFlight ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : flightLookupMessage.includes("auto-filled") ? (
                    <CheckCircleIcon className="h-5 w-5" />
                  ) : (
                    <ClockIcon className="h-5 w-5" />
                  )}
                  <span>
                    {isLookingUpFlight
                      ? "Searching flight records..."
                      : flightLookupMessage || "Enter a flight number to auto-fill the departure time."}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Departure Date & Time</label>
                <input
                  type="datetime-local"
                  value={departureDateTime}
                  disabled
                  className="input input-bordered w-full rounded-2xl bg-base-200 text-base-content/70 disabled:border-base-300 disabled:bg-base-200"
                />
                <div className="mt-2 text-xs text-base-content/60">
                  This field is auto-filled from the flight record in UTC and locked for consistency.
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Policy Type</label>
                <select value={policyType} disabled className="select select-bordered w-full rounded-2xl bg-base-200">
                  {POLICY_TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Coverage Amount (USDC)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={coverageAmount}
                  readOnly
                  className="input input-bordered w-full rounded-2xl bg-base-200"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Premium (USDC)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={premium}
                  readOnly
                  className="input input-bordered w-full rounded-2xl bg-base-200"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">Policy Window (hours)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={durationHours}
                  readOnly
                  className="input input-bordered w-full rounded-2xl bg-base-200"
                />
              </div>

              {policyType === 0 && (
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Delay Threshold (hours)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={delayThresholdHours}
                    onChange={event => setDelayThresholdHours(event.target.value)}
                    className="input input-bordered w-full rounded-2xl bg-base-200"
                  />
                </div>
              )}

              {selectedPlan && (
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Payout Trigger</label>
                  <input
                    type="text"
                    value={getTriggerLabel(selectedPlan)}
                    readOnly
                    className="input input-bordered w-full rounded-2xl bg-base-200"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-3xl bg-base-200/70 p-5 text-sm md:grid-cols-2">
              <div className="rounded-2xl bg-base-100/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">Wallet Balance</div>
                <div className="mt-2 text-xl font-semibold">{balanceDisplay} USDC</div>
              </div>
              <div className="rounded-2xl bg-base-100/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">Allowance</div>
                <div className="mt-2 text-xl font-semibold">{allowanceDisplay} USDC</div>
              </div>
              <div className="rounded-2xl bg-base-100/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">Approval Status</div>
                <div className="mt-2 text-xl font-semibold">
                  {hasEnoughAllowance ? "Ready to buy" : "Approval required"}
                </div>
              </div>
              <div className="rounded-2xl bg-base-100/80 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">Selected Premium</div>
                <div className="mt-2 text-xl font-semibold">{premium || "0"} USDC</div>
              </div>
              <div className="md:col-span-2 rounded-2xl bg-base-100/80 p-4 break-all">
                <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">PolicyManager</div>
                <div className="mt-2 font-mono text-sm">{POLICY_MANAGER_ADDRESS}</div>
              </div>
            </div>

            {!hasEnoughAllowance && (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning-content">
                Please approve MockUSDC for the selected premium before buying the policy.
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="btn btn-outline btn-primary h-14 flex-1 rounded-2xl"
                onClick={handleApprove}
                disabled={!canApprove}
              >
                {isApproving ? "Approving..." : "Approve USDC"}
              </button>

              <button className="btn btn-primary h-14 flex-1 rounded-2xl" onClick={handleBuyPolicy} disabled={!canBuy}>
                {isBuying ? "Purchasing..." : "Buy Policy"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-base-300 bg-base-200/50 p-5">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-base-content/50">
              Purchase Checklist
            </div>
            <div className="mt-4 space-y-3">
              {purchaseChecklist.map(item => (
                <div
                  key={item.label}
                  className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                    item.isComplete ? "border-success/20 bg-success/10" : "border-base-300 bg-base-100"
                  }`}
                >
                  {item.isComplete ? (
                    <CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-success" />
                  ) : (
                    <ExclamationCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-warning" />
                  )}
                  <div>
                    <div className="font-semibold">{item.label}</div>
                    <div className="mt-1 text-sm text-base-content/65">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-base-100 p-4 text-sm">
              <div className="font-semibold">Ready to purchase?</div>
              <div className="mt-1 text-base-content/70">
                {canBuy
                  ? "Everything looks good. You can approve if needed and purchase the policy."
                  : "Complete the remaining checklist items and we’ll enable purchase automatically."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
