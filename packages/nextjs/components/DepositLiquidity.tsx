"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";

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

const insurancePoolAbi = [
  {
    type: "function",
    name: "depositLiquidity",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getPoolBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const MOCK_USDC_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const INSURANCE_POOL_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
const TOKEN_DECIMALS = 18;

export default function DepositLiquidity() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [approving, setApproving] = useState(false);
  const [depositing, setDepositing] = useState(false);

  const parsedAmount = useMemo(() => {
    if (!amount.trim()) return 0n;
    try {
      return parseUnits(amount, TOKEN_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: mockUsdcAbi,
    address: MOCK_USDC_ADDRESS,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: mockUsdcAbi,
    address: MOCK_USDC_ADDRESS,
    functionName: "allowance",
    args: address ? [address, INSURANCE_POOL_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  const { data: poolBalance, refetch: refetchPoolBalance } = useReadContract({
    abi: insurancePoolAbi,
    address: INSURANCE_POOL_ADDRESS,
    functionName: "getPoolBalance",
  });

  const approvedEnough = allowance !== undefined && allowance >= parsedAmount;
  const hasValidAmount = parsedAmount > 0n;
  const hasEnoughBalance = balance !== undefined && balance >= parsedAmount;

  const refreshAll = async () => {
    await Promise.all([refetchBalance(), refetchAllowance(), refetchPoolBalance()]);
  };

  const handleApprove = async () => {
    if (!isConnected || !address) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!hasValidAmount) {
      setStatus("Enter a valid amount.");
      return;
    }

    try {
      setApproving(true);
      setStatus("Waiting for approval transaction...");

      const txHash = await writeContractAsync({
        abi: mockUsdcAbi,
        address: MOCK_USDC_ADDRESS,
        functionName: "approve",
        args: [INSURANCE_POOL_ADDRESS, parsedAmount],
      });

      setStatus(`Approval submitted: ${txHash}`);
      await refreshAll();
      setStatus("Approval successful. You can now deposit.");
    } catch (error) {
      console.error(error);
      setStatus("Approval failed or was rejected.");
    } finally {
      setApproving(false);
    }
  };

  const handleDeposit = async () => {
    if (!isConnected || !address) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!hasValidAmount) {
      setStatus("Enter a valid amount.");
      return;
    }
    if (!approvedEnough) {
      setStatus("Approve USDC first.");
      return;
    }

    try {
      setDepositing(true);
      setStatus("Waiting for deposit transaction...");

      const txHash = await writeContractAsync({
        abi: insurancePoolAbi,
        address: INSURANCE_POOL_ADDRESS,
        functionName: "depositLiquidity",
        args: [parsedAmount],
      });

      setStatus(`Deposit submitted: ${txHash}`);
      await refreshAll();
      setStatus("Deposit successful.");
      setAmount("");
    } catch (error) {
      console.error(error);
      setStatus("Deposit failed or was rejected.");
    } finally {
      setDepositing(false);
    }
  };

  return (
    <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-base-300 bg-base-100 p-6 shadow">
      <div className="mb-4">
        <Link href="/admin" className="btn btn-outline btn-sm">
          ← Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Deposit Liquidity</h1>

      <div className="space-y-2 mb-4">
        <label className="text-sm font-medium">Amount</label>
        <input
          type="text"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="1000"
          className="input input-bordered w-full text-lg"
        />
      </div>

      <div className="rounded-xl bg-base-200 p-4 space-y-2 text-sm mb-6">
        <p>
          <span className="font-semibold">Your USDC Balance:</span>{" "}
          {balance !== undefined ? formatUnits(balance, TOKEN_DECIMALS) : "-"}
        </p>
        <p>
          <span className="font-semibold">Allowance:</span>{" "}
          {allowance !== undefined ? formatUnits(allowance, TOKEN_DECIMALS) : "-"}
        </p>
        <p>
          <span className="font-semibold">Pool Balance:</span>{" "}
          {poolBalance !== undefined ? formatUnits(poolBalance, TOKEN_DECIMALS) : "-"}
        </p>
      </div>

      {!isConnected && (
        <div className="alert alert-warning mb-4">
          <span>Connect your wallet first.</span>
        </div>
      )}

      {hasValidAmount && !hasEnoughBalance && (
        <div className="alert alert-error mb-4">
          <span>Insufficient USDC balance for this amount.</span>
        </div>
      )}

      {hasValidAmount && !approvedEnough && isConnected && (
        <div className="alert alert-info mb-4">
          <span>Step 1: Approve USDC. Step 2: Deposit to Pool.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleApprove}
          disabled={!isConnected || !hasValidAmount || !hasEnoughBalance || approving}
          className="btn btn-primary"
        >
          {approving ? "Approving..." : "Approve USDC"}
        </button>

        <button
          onClick={handleDeposit}
          disabled={!isConnected || !hasValidAmount || !hasEnoughBalance || !approvedEnough || depositing}
          className="btn btn-secondary"
        >
          {depositing ? "Depositing..." : "Deposit to Pool"}
        </button>
      </div>

      {status && <div className="mt-4 rounded-xl bg-base-200 p-3 text-sm break-all">{status}</div>}
    </div>
  );
}
