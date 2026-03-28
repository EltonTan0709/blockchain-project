import { onchainTable } from "ponder";

export const gasTransactions = onchainTable("gas_transactions", t => ({
  id: t.text().primaryKey(),
  actionType: t.text().notNull(),
  transactionHash: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  gasUsed: t.bigint().notNull(),
  effectiveGasPrice: t.bigint().notNull(),
  feeWei: t.bigint().notNull(),
  actor: t.hex().notNull(),
  policyId: t.bigint(),
  requestId: t.bigint(),
  amount: t.bigint(),
  premium: t.bigint(),
  coverageAmount: t.bigint(),
  payoutAmount: t.bigint(),
  delayMinutes: t.bigint(),
  outcome: t.integer(),
  flightNumber: t.text(),
}));

export default {
  gasTransactions,
};
