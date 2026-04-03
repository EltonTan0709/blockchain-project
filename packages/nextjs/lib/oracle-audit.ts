import { type OracleRequestAudit, OracleRequestAuditStatus } from "@prisma/client";
import { prisma } from "~~/lib/prisma";

export const ORACLE_REQUEST_STATUS = {
  IDLE: 0,
  REQUESTED: 1,
  FULFILLED: 2,
  FAILED: 3,
  EXPIRED: 4,
} as const;

export type OracleAuditMetadata = {
  sources?: Array<{
    sourceId: string;
    sourceLabel: string;
    outcome: number;
    delayMinutes: number;
    payoutEligible: boolean;
    reason: string;
  }>;
  reason?: string;
  winningVotes?: number;
  totalVotes?: number;
  oracleReadyTimestamp?: string;
  requestTransactionHash?: string;
  callbackTransactionHash?: string;
  workerMode?: string;
  retryCount?: number;
};

export type SerializedOracleRequestAudit = {
  id: string;
  chainId: number;
  policyId: string;
  requestId: string | null;
  chainlinkRequestId: string | null;
  flightKey: string | null;
  requestStatus: number;
  auditStatus: OracleRequestAuditStatus;
  usedChainlink: boolean;
  flightId: string | null;
  flightNumber: string | null;
  flightStatus: string | null;
  latestNote: string | null;
  outcome: number | null;
  delayMinutes: number | null;
  payoutEligible: boolean | null;
  payoutExecuted: boolean | null;
  payoutAmount: string | null;
  transactionHash: string | null;
  errorMessage: string | null;
  metadata: OracleAuditMetadata | null;
  createdAt: string;
  updatedAt: string;
};

export const serializeOracleRequestAudit = (audit: OracleRequestAudit): SerializedOracleRequestAudit => {
  return {
    id: audit.id,
    chainId: audit.chainId,
    policyId: audit.policyId.toString(),
    requestId: audit.requestId?.toString() ?? null,
    chainlinkRequestId: audit.chainlinkRequestId,
    flightKey: audit.flightKey,
    requestStatus: audit.requestStatus,
    auditStatus: audit.auditStatus,
    usedChainlink: audit.usedChainlink,
    flightId: audit.flightId,
    flightNumber: audit.flightNumber,
    flightStatus: audit.flightStatus,
    latestNote: audit.latestNote,
    outcome: audit.outcome,
    delayMinutes: audit.delayMinutes,
    payoutEligible: audit.payoutEligible,
    payoutExecuted: audit.payoutExecuted,
    payoutAmount: audit.payoutAmount,
    transactionHash: audit.transactionHash,
    errorMessage: audit.errorMessage,
    metadata: (audit.metadata as OracleAuditMetadata | null) ?? null,
    createdAt: audit.createdAt.toISOString(),
    updatedAt: audit.updatedAt.toISOString(),
  };
};

export const listOracleRequestAudits = async (limit = 25) => {
  const safeLimit = Math.max(1, Math.min(limit, 100));

  const audits = await prisma.oracleRequestAudit.findMany({
    orderBy: [{ policyId: "desc" }, { createdAt: "desc" }],
    take: safeLimit,
  });

  return audits.map(serializeOracleRequestAudit);
};

export const listOracleRequestAuditsByPolicyIds = async (chainId: number, policyIds: bigint[]) => {
  if (policyIds.length === 0) {
    return [];
  }

  const audits = await prisma.oracleRequestAudit.findMany({
    where: {
      chainId,
      policyId: {
        in: policyIds,
      },
    },
    orderBy: [{ policyId: "desc" }, { createdAt: "desc" }],
  });

  return audits.map(serializeOracleRequestAudit);
};

export const summarizeOracleAudits = (audits: SerializedOracleRequestAudit[]) => {
  return audits.reduce<Record<OracleRequestAuditStatus, number>>(
    (summary, audit) => {
      summary[audit.auditStatus] += 1;
      return summary;
    },
    {
      REQUESTED: 0,
      AWAITING_CHAINLINK: 0,
      FULFILLED: 0,
      FAILED: 0,
      EXPIRED: 0,
    },
  );
};
