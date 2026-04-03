"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatUnits, parseUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import {
  ArrowLeftIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/solid";
import deployedContracts from "~~/contracts/deployedContracts";
import { CONTRACTS } from "~~/utils/scaffold-eth/contract";

const TOKEN_DECIMALS = CONTRACTS.TOKEN_DECIMALS;

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
  {
    type: "function",
    name: "getRequiredReserve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getWithdrawableAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdrawExcessLiquidity",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

const formatTokenValue = (value?: bigint) => {
  return value !== undefined ? `${formatUnits(value, TOKEN_DECIMALS)} USDC` : "-";
};

export default function DepositLiquidity() {
  const { address, isConnected, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const chainId = chain?.id as keyof typeof deployedContracts | undefined;
  const chainContracts = chainId
    ? ((deployedContracts as Record<number, { MockUSDC?: { address: string }; InsurancePool?: { address: string } }>)[
        Number(chainId)
      ] ?? undefined)
    : undefined;

  const [amount, setAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [status, setStatus] = useState("");
  const [approving, setApproving] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const mockUsdcAddress = chainContracts?.MockUSDC?.address as `0x${string}` | undefined;
  const insurancePoolAddress = chainContracts?.InsurancePool?.address as `0x${string}` | undefined;
  const hasLiveAddresses = !!mockUsdcAddress && !!insurancePoolAddress;

  const parsedAmount = useMemo(() => {
    if (!amount.trim()) return 0n;
    try {
      return parseUnits(amount, TOKEN_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const parsedWithdrawAmount = useMemo(() => {
    if (!withdrawAmount.trim()) return 0n;
    try {
      return parseUnits(withdrawAmount, TOKEN_DECIMALS);
    } catch {
      return 0n;
    }
  }, [withdrawAmount]);

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: mockUsdcAbi,
    address: mockUsdcAddress,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && hasLiveAddresses },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: mockUsdcAbi,
    address: mockUsdcAddress,
    functionName: "allowance",
    args: address && insurancePoolAddress ? [address, insurancePoolAddress] : undefined,
    query: { enabled: !!address && hasLiveAddresses },
  });

  const { data: poolBalance, refetch: refetchPoolBalance } = useReadContract({
    abi: insurancePoolAbi,
    address: insurancePoolAddress,
    functionName: "getPoolBalance",
    query: { enabled: hasLiveAddresses },
  });

  const { data: requiredReserve, refetch: refetchRequiredReserve } = useReadContract({
    abi: insurancePoolAbi,
    address: insurancePoolAddress,
    functionName: "getRequiredReserve",
    query: { enabled: hasLiveAddresses },
  });

  const { data: withdrawableAmount, refetch: refetchWithdrawableAmount } = useReadContract({
    abi: insurancePoolAbi,
    address: insurancePoolAddress,
    functionName: "getWithdrawableAmount",
    query: { enabled: hasLiveAddresses },
  });

  const approvedEnough = allowance !== undefined && allowance >= parsedAmount;
  const hasValidAmount = parsedAmount > 0n;
  const hasEnoughBalance = balance !== undefined && balance >= parsedAmount;
  const hasValidWithdrawAmount = parsedWithdrawAmount > 0n;
  const canCoverWithdraw = withdrawableAmount !== undefined && withdrawableAmount >= parsedWithdrawAmount;

  const refreshAll = async () => {
    await Promise.all([
      refetchBalance(),
      refetchAllowance(),
      refetchPoolBalance(),
      refetchRequiredReserve(),
      refetchWithdrawableAmount(),
    ]);
  };

  const handleApprove = async () => {
    if (!isConnected || !address) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!hasLiveAddresses) {
      setStatus("Connect to the deployed Sepolia network first.");
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
        address: mockUsdcAddress,
        functionName: "approve",
        args: [insurancePoolAddress, parsedAmount],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

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
    if (!hasLiveAddresses) {
      setStatus("Connect to the deployed Sepolia network first.");
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
        address: insurancePoolAddress,
        functionName: "depositLiquidity",
        args: [parsedAmount],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

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

  const handleWithdraw = async () => {
    if (!isConnected || !address) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!hasLiveAddresses) {
      setStatus("Connect to the deployed Sepolia network first.");
      return;
    }
    if (!hasValidWithdrawAmount) {
      setStatus("Enter a valid withdrawal amount.");
      return;
    }
    if (!canCoverWithdraw) {
      setStatus("Withdrawal amount exceeds the pool's withdrawable excess.");
      return;
    }

    try {
      setWithdrawing(true);
      setStatus("Waiting for withdrawal transaction...");

      const txHash = await writeContractAsync({
        abi: insurancePoolAbi,
        address: insurancePoolAddress,
        functionName: "withdrawExcessLiquidity",
        args: [parsedWithdrawAmount],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      setStatus(`Withdrawal submitted: ${txHash}`);
      await refreshAll();
      setStatus("Withdrawal successful.");
      setWithdrawAmount("");
    } catch (error) {
      console.error(error);
      setStatus("Withdrawal failed or was rejected.");
    } finally {
      setWithdrawing(false);
    }
  };

  const poolChecklist = [
    {
      label: "Wallet connected",
      detail: isConnected ? "Admin wallet is connected and ready." : "Connect the configured admin wallet first.",
      done: isConnected,
    },
    {
      label: "Sepolia contracts loaded",
      detail: hasLiveAddresses
        ? "Live MockUSDC and InsurancePool addresses are loaded for this network."
        : "Connect to Sepolia to load the deployed pool contracts.",
      done: hasLiveAddresses,
    },
    {
      label: "Valid amount entered",
      detail: hasValidAmount ? `${amount} USDC prepared for deposit.` : "Enter the amount of USDC to fund the pool.",
      done: hasValidAmount,
    },
    {
      label: "Sufficient balance",
      detail: hasEnoughBalance
        ? "Wallet balance covers the deposit amount."
        : "Wallet needs more MockUSDC for this deposit.",
      done: hasEnoughBalance,
    },
    {
      label: "Allowance approved",
      detail: approvedEnough
        ? "Pool contract already has enough allowance."
        : "Approve the pool contract before depositing.",
      done: approvedEnough,
    },
    {
      label: "Reserve protected",
      detail:
        requiredReserve !== undefined
          ? `${formatUnits(requiredReserve, TOKEN_DECIMALS)} USDC is currently reserved for active policies.`
          : "Load the pool contracts to read the active policy reserve.",
      done: requiredReserve !== undefined,
    },
    {
      label: "Withdrawable excess",
      detail:
        withdrawableAmount !== undefined
          ? `${formatUnits(withdrawableAmount, TOKEN_DECIMALS)} USDC can be withdrawn without touching reserved coverage.`
          : "Load the pool contracts to calculate safe withdrawal headroom.",
      done: withdrawableAmount !== undefined,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-base-300 bg-base-100 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_30%)]" />
        <div className="relative grid gap-8 px-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] xl:grid-cols-[minmax(0,1fr)_minmax(24rem,30rem)] lg:items-end">
          <div>
            <Link href="/admin" className="btn btn-outline btn-sm rounded-full">
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Dashboard
            </Link>

            <div className="mt-5 badge badge-outline border-secondary/30 bg-secondary/10 px-4 py-4 text-secondary">
              Liquidity Pool
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">Manage Liquidity Pool</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-base-content/70">
              Fund the insurance pool with MockUSDC, then withdraw only the excess capital that sits above active policy
              reserve.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <BanknotesIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs uppercase leading-5 tracking-[0.14em] text-base-content/45 break-words">
                    Pool Balance
                  </div>
                  <div className="mt-1 text-2xl font-black">{formatTokenValue(poolBalance)}</div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-success/10 p-3 text-success">
                  <ShieldCheckIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs uppercase leading-5 tracking-[0.14em] text-base-content/45 break-words">
                    Wallet Balance
                  </div>
                  <div className="mt-1 text-2xl font-black">{formatTokenValue(balance)}</div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-warning/10 p-3 text-warning">
                  <ShieldCheckIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs uppercase leading-5 tracking-[0.14em] text-base-content/45 break-words">
                    Required Reserve
                  </div>
                  <div className="mt-1 text-2xl font-black">{formatTokenValue(requiredReserve)}</div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-base-300 bg-base-100/90 p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-secondary/10 p-3 text-secondary">
                  <BanknotesIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs uppercase leading-5 tracking-[0.14em] text-base-content/45 break-words">
                    Withdrawable Excess
                  </div>
                  <div className="mt-1 text-2xl font-black">{formatTokenValue(withdrawableAmount)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(18rem,0.9fr)]">
        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Fund The Pool</h2>
          <p className="mt-2 text-sm leading-7 text-base-content/65">
            Approve the pool contract to spend MockUSDC, then submit the deposit once allowance is ready.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">Deposit Amount (USDC)</label>
              <input
                type="text"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="1000"
                className="input input-bordered h-16 w-full rounded-2xl text-lg font-medium"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-base-200/70 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-base-content/45">Your USDC</div>
                <div className="mt-2 text-xl font-bold">{formatTokenValue(balance)}</div>
              </div>
              <div className="rounded-2xl bg-base-200/70 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-base-content/45">Allowance</div>
                <div className="mt-2 text-xl font-bold">{formatTokenValue(allowance)}</div>
              </div>
              <div className="rounded-2xl bg-base-200/70 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-base-content/45">Pool Total</div>
                <div className="mt-2 text-xl font-bold">{formatTokenValue(poolBalance)}</div>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl bg-base-200/50 p-4 text-sm">
              <div className="break-all">
                <div className="text-xs uppercase tracking-[0.16em] text-base-content/45">MockUSDC Address</div>
                <div className="mt-2 font-mono">{mockUsdcAddress}</div>
              </div>
              <div className="break-all">
                <div className="text-xs uppercase tracking-[0.16em] text-base-content/45">InsurancePool Address</div>
                <div className="mt-2 font-mono">{insurancePoolAddress}</div>
              </div>
            </div>

            {!hasLiveAddresses && (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                Connect to Sepolia so this page uses the live deployed MockUSDC and InsurancePool contracts.
              </div>
            )}

            {!isConnected && (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                Connect your wallet first.
              </div>
            )}

            {hasValidAmount && !hasEnoughBalance && (
              <div className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">
                Insufficient USDC balance for this amount.
              </div>
            )}

            {hasValidAmount && !approvedEnough && isConnected && (
              <div className="rounded-2xl border border-info/30 bg-info/10 p-4 text-sm text-info-content">
                Step 1: Approve USDC. Step 2: Deposit liquidity into the pool.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleApprove}
                disabled={!isConnected || !hasLiveAddresses || !hasValidAmount || !hasEnoughBalance || approving}
                className="btn btn-primary h-14 rounded-2xl px-6"
              >
                {approving ? "Approving..." : "Approve USDC"}
              </button>

              <button
                onClick={handleDeposit}
                disabled={
                  !isConnected ||
                  !hasLiveAddresses ||
                  !hasValidAmount ||
                  !hasEnoughBalance ||
                  !approvedEnough ||
                  depositing
                }
                className="btn btn-secondary h-14 rounded-2xl px-6"
              >
                {depositing ? "Depositing..." : "Deposit to Pool"}
              </button>
            </div>

            {status && <div className="rounded-2xl bg-base-200 p-4 text-sm break-all">{status}</div>}
          </div>
        </div>

        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Withdraw Excess Capital</h2>
          <p className="mt-2 text-sm leading-7 text-base-content/65">
            Owner withdrawals are limited on-chain to the pool balance that remains after active policy coverage is
            reserved.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">Withdrawal Amount (USDC)</label>
              <input
                type="text"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="250"
                className="input input-bordered h-16 w-full rounded-2xl text-lg font-medium"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-base-200/70 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-base-content/45">Required Reserve</div>
                <div className="mt-2 text-xl font-bold">{formatTokenValue(requiredReserve)}</div>
              </div>
              <div className="rounded-2xl bg-base-200/70 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-base-content/45">Safe To Withdraw</div>
                <div className="mt-2 text-xl font-bold">{formatTokenValue(withdrawableAmount)}</div>
              </div>
            </div>

            <div className="rounded-2xl bg-base-200/60 p-4 text-sm">
              <div className="font-semibold">How the cap works</div>
              <div className="mt-2 leading-7 text-base-content/65">
                The contract keeps active policy coverage reserved. Only the excess above that reserve can be withdrawn,
                so the pool cannot be drained below currently outstanding exposure.
              </div>
            </div>

            {hasValidWithdrawAmount && !canCoverWithdraw && isConnected && (
              <div className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">
                This amount is higher than the pool&apos;s current withdrawable excess.
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={
                !isConnected || !hasLiveAddresses || !hasValidWithdrawAmount || !canCoverWithdraw || withdrawing
              }
              className="btn btn-accent h-14 rounded-2xl px-6"
            >
              {withdrawing ? "Withdrawing..." : "Withdraw Excess Liquidity"}
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Pool Safety Snapshot</h2>
          <div className="mt-5 space-y-3">
            {poolChecklist.map(item => (
              <div
                key={item.label}
                className={`flex items-start gap-3 rounded-2xl border p-4 ${item.done ? "border-success/20 bg-success/10" : "border-base-300 bg-base-200/40"}`}
              >
                {item.done ? (
                  <CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-success" />
                ) : (
                  <ExclamationTriangleIcon className="mt-0.5 h-6 w-6 shrink-0 text-warning" />
                )}
                <div>
                  <div className="font-semibold">{item.label}</div>
                  <div className="mt-1 text-sm leading-6 text-base-content/65">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-base-200/60 p-4 text-sm">
            <div className="font-semibold">Operational note</div>
            <div className="mt-2 leading-7 text-base-content/65">
              Loss ratio and pending claims still matter operationally, but the hard withdrawal guard now comes from
              live on-chain active coverage reserve instead of a manual estimate.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
