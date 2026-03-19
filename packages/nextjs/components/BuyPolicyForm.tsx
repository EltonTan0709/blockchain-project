"use client";

import { useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import deployedContracts from "~~/contracts/deployedContracts";
import { notification } from "~~/utils/scaffold-eth";
import { CONTRACTS } from "~~/utils/scaffold-eth/contract";

const POLICY_TYPE_OPTIONS = [
  { label: "Flight Delay", value: 0 },
  { label: "Flight Cancellation", value: 1 },
] as const;

const HOURS_IN_SECONDS = 3600;

export const BuyPolicyForm = () => {
  const { address, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [flightNumber, setFlightNumber] = useState("");
  const [departureDateTime, setDepartureDateTime] = useState("");
  const [policyType, setPolicyType] = useState(0);
  const [coverageAmount, setCoverageAmount] = useState("100");
  const [durationHours, setDurationHours] = useState("24");
  const [premium, setPremium] = useState("10");
  const [isApproving, setIsApproving] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  const chainId = chain?.id as keyof typeof deployedContracts | undefined;
  const contracts = chainId ? deployedContracts[chainId] : undefined;

  const mockUSDCAbi = contracts?.MockUSDC?.abi;
  const policyManagerAbi = contracts?.PolicyManager?.abi;

  const MOCK_USDC_ADDRESS = CONTRACTS.MockUSDC as `0x${string}`;
  const POLICY_MANAGER_ADDRESS = CONTRACTS.PolicyManager as `0x${string}`;
  const TOKEN_DECIMALS = CONTRACTS.TOKEN_DECIMALS;

  const departureTimestamp = useMemo(() => {
    if (!departureDateTime) return 0;
    const ms = new Date(departureDateTime).getTime();
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

  const currentUnixTime = Math.floor(Date.now() / 1000);

  const isAbiReady = !!mockUSDCAbi && !!policyManagerAbi;
  const isFlightNumberValid = flightNumber.trim().length > 0;
  const isDepartureValid = departureTimestamp > currentUnixTime;
  const isCoverageValid = coverageAmountParsed !== undefined && Number(coverageAmount) > 0;
  const isPremiumValid = premiumParsed !== undefined && Number(premium) > 0;
  const isDurationValid = durationParsed > 0;

  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: mockUSDCAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!mockUSDCAbi && !!address,
    },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: mockUSDCAbi,
    functionName: "allowance",
    args: address ? [address, POLICY_MANAGER_ADDRESS] : undefined,
    query: {
      enabled: !!mockUSDCAbi && !!address,
    },
  });

  const balanceDisplay = typeof usdcBalance === "bigint" ? formatUnits(usdcBalance, TOKEN_DECIMALS) : "—";

  const allowanceDisplay = typeof allowance === "bigint" ? formatUnits(allowance, TOKEN_DECIMALS) : "—";

  const allowanceBigInt = typeof allowance === "bigint" ? allowance : 0n;
  const hasEnoughAllowance = !!premiumParsed && allowanceBigInt >= premiumParsed;

  const canApprove = isAbiReady && isPremiumValid && !hasEnoughAllowance;

  const canBuy =
    !!policyManagerAbi &&
    isFlightNumberValid &&
    isDepartureValid &&
    isCoverageValid &&
    isPremiumValid &&
    isDurationValid &&
    hasEnoughAllowance &&
    !isBuying;

  const refreshTokenState = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await refetchAllowance();
    await refetchUsdcBalance();
  };

  const resetForm = () => {
    setFlightNumber("");
    setDepartureDateTime("");
    setPolicyType(0);
    setCoverageAmount("100");
    setDurationHours("24");
    setPremium("10");
  };

  const handleApprove = async () => {
    if (!mockUSDCAbi || !policyManagerAbi || !premiumParsed) {
      notification.error("Missing contract configuration or invalid premium.");
      return;
    }

    try {
      setIsApproving(true);

      await writeContractAsync({
        address: MOCK_USDC_ADDRESS,
        abi: mockUSDCAbi,
        functionName: "approve",
        args: [POLICY_MANAGER_ADDRESS, premiumParsed],
      });

      await refreshTokenState();
      notification.success("USDC approved successfully.");
    } catch (error: any) {
      notification.error(error?.shortMessage || error?.message || "Approve failed.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleBuyPolicy = async () => {
    if (!policyManagerAbi || !coverageAmountParsed || !premiumParsed) {
      notification.error("Missing contract configuration or invalid inputs.");
      return;
    }

    try {
      setIsBuying(true);

      await writeContractAsync({
        address: POLICY_MANAGER_ADDRESS,
        abi: policyManagerAbi,
        functionName: "buyPolicy",
        args: [
          flightNumber.trim(),
          BigInt(departureTimestamp),
          policyType,
          coverageAmountParsed,
          BigInt(durationParsed),
          premiumParsed,
        ],
      });

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
      <div className="rounded-3xl border bg-base-100 p-8 shadow-xl">
        <h1 className="text-3xl font-bold">Buy Flight Insurance</h1>
        <p className="mt-2 text-base-content/70">
          Protect your trip against flight delays and cancellations using MockUSDC.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Flight Number</label>
            <input
              type="text"
              value={flightNumber}
              onChange={e => setFlightNumber(e.target.value)}
              placeholder="e.g. SQ318"
              className="input input-bordered w-full"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Departure Date & Time</label>
            <input
              type="datetime-local"
              value={departureDateTime}
              onChange={e => setDepartureDateTime(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Policy Type</label>
            <select
              value={policyType}
              onChange={e => setPolicyType(Number(e.target.value))}
              className="select select-bordered w-full"
            >
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
              onChange={e => setCoverageAmount(e.target.value)}
              placeholder="100"
              className="input input-bordered w-full"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Premium (USDC)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={premium}
              onChange={e => setPremium(e.target.value)}
              placeholder="10"
              className="input input-bordered w-full"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Claim Window Duration (hours)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={durationHours}
              onChange={e => setDurationHours(e.target.value)}
              placeholder="24"
              className="input input-bordered w-full"
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 rounded-2xl bg-base-200 p-4 text-sm md:grid-cols-2">
          <div>
            <span className="font-semibold">Wallet Balance:</span> {balanceDisplay} USDC
          </div>
          <div>
            <span className="font-semibold">Allowance to PolicyManager:</span> {allowanceDisplay} USDC
          </div>
          <div>
            <span className="font-semibold">Approval Status:</span>{" "}
            {hasEnoughAllowance ? "Ready to buy" : "Approval required"}
          </div>
          <div>
            <span className="font-semibold">Selected Premium:</span> {premium || "0"} USDC
          </div>
          <div className="md:col-span-2 break-all">
            <span className="font-semibold">PolicyManager:</span> {POLICY_MANAGER_ADDRESS}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-base-300 bg-base-200 p-4 text-sm">
          <div className="mb-2 font-semibold">Purchase checklist</div>
          <div>Flight number: {isFlightNumberValid ? "OK" : "Missing"}</div>
          <div>Departure time: {isDepartureValid ? "OK" : "Must be in the future"}</div>
          <div>Coverage amount: {isCoverageValid ? "OK" : "Invalid"}</div>
          <div>Premium: {isPremiumValid ? "OK" : "Invalid"}</div>
          <div>Claim window: {isDurationValid ? "OK" : "Invalid"}</div>
          <div>Allowance: {hasEnoughAllowance ? "OK" : "Approval required"}</div>
          <div>Contract ABI: {isAbiReady ? "OK" : "Not loaded"}</div>
        </div>

        {!hasEnoughAllowance && (
          <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
            Please approve MockUSDC for the selected premium before buying the policy.
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            className="btn btn-outline btn-primary flex-1"
            onClick={handleApprove}
            disabled={!canApprove || isApproving}
          >
            {isApproving ? "Approving..." : "Approve USDC"}
          </button>

          <button className="btn btn-primary flex-1" onClick={handleBuyPolicy} disabled={!canBuy || isBuying}>
            {isBuying ? "Purchasing..." : "Buy Policy"}
          </button>
        </div>
      </div>
    </div>
  );
};
