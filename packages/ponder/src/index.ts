import { ponder } from "ponder:registry";
import { gasTransactions } from "ponder:schema";

const registry = ponder as {
  on: (eventName: string, handler: (args: PonderHandlerArgs) => Promise<void> | void) => void;
};

type PonderHandlerArgs = {
  event: any;
  context: any;
};

type GasTransactionInput = {
  event: {
    id: string;
    transaction: { hash: `0x${string}` };
    block: { number: bigint; timestamp: bigint };
    transactionReceipt: {
      gasUsed: bigint;
      effectiveGasPrice?: bigint | null;
    };
  };
  actionType: "depositLiquidity" | "buyPolicy" | "oracleRequest" | "oracleFulfillment";
  actor: `0x${string}`;
  policyId?: bigint;
  requestId?: bigint;
  amount?: bigint;
  premium?: bigint;
  coverageAmount?: bigint;
  payoutAmount?: bigint;
  delayMinutes?: bigint;
  outcome?: number;
  flightNumber?: string;
};

const buildGasTransaction = ({
  event,
  actionType,
  actor,
  policyId,
  requestId,
  amount,
  premium,
  coverageAmount,
  payoutAmount,
  delayMinutes,
  outcome,
  flightNumber,
}: GasTransactionInput) => {
  const effectiveGasPrice = event.transactionReceipt.effectiveGasPrice ?? 0n;

  return {
    id: event.id,
    actionType,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    gasUsed: event.transactionReceipt.gasUsed,
    effectiveGasPrice,
    feeWei: event.transactionReceipt.gasUsed * effectiveGasPrice,
    actor,
    policyId,
    requestId,
    amount,
    premium,
    coverageAmount,
    payoutAmount,
    delayMinutes,
    outcome,
    flightNumber,
  };
};

registry.on("InsurancePool:LiquidityDeposited", async ({ event, context }: PonderHandlerArgs) => {
  await context.db.insert(gasTransactions).values(
    buildGasTransaction({
      event,
      actionType: "depositLiquidity",
      actor: event.args.provider,
      amount: event.args.amount,
    }),
  );
});

registry.on("PolicyManager:PolicyPurchased", async ({ event, context }: PonderHandlerArgs) => {
  await context.db.insert(gasTransactions).values(
    buildGasTransaction({
      event,
      actionType: "buyPolicy",
      actor: event.args.holder,
      policyId: event.args.policyId,
      premium: event.args.premium,
      coverageAmount: event.args.coverageAmount,
      flightNumber: event.args.flightNumber,
    }),
  );
});

registry.on("OracleCoordinator:OracleCheckRequested", async ({ event, context }: PonderHandlerArgs) => {
  await context.db.insert(gasTransactions).values(
    buildGasTransaction({
      event,
      actionType: "oracleRequest",
      actor: event.args.requester,
      policyId: event.args.policyId,
      requestId: event.args.requestId,
    }),
  );
});

registry.on("OracleCoordinator:OracleCheckFulfilled", async ({ event, context }: PonderHandlerArgs) => {
  await context.db.insert(gasTransactions).values(
    buildGasTransaction({
      event,
      actionType: "oracleFulfillment",
      actor: event.args.reporter,
      policyId: event.args.policyId,
      requestId: event.args.requestId,
      payoutAmount: event.args.payoutAmount,
      delayMinutes: event.args.delayMinutes,
      outcome: Number(event.args.outcome),
    }),
  );
});
