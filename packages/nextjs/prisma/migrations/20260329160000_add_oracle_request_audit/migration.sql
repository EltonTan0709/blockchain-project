-- CreateEnum
CREATE TYPE "OracleRequestAuditStatus" AS ENUM ('REQUESTED', 'AWAITING_CHAINLINK', 'FULFILLED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "OracleRequestAudit" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "policyId" BIGINT NOT NULL,
    "requestId" BIGINT,
    "chainlinkRequestId" TEXT,
    "flightKey" TEXT,
    "requestStatus" INTEGER NOT NULL,
    "auditStatus" "OracleRequestAuditStatus" NOT NULL,
    "usedChainlink" BOOLEAN NOT NULL,
    "flightId" TEXT,
    "flightNumber" TEXT,
    "flightStatus" "FlightStatus",
    "latestNote" TEXT,
    "outcome" INTEGER,
    "delayMinutes" INTEGER,
    "payoutEligible" BOOLEAN,
    "payoutExecuted" BOOLEAN,
    "payoutAmount" TEXT,
    "transactionHash" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OracleRequestAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OracleRequestAudit_chainId_policyId_key" ON "OracleRequestAudit"("chainId", "policyId");

-- CreateIndex
CREATE INDEX "OracleRequestAudit_chainId_auditStatus_idx" ON "OracleRequestAudit"("chainId", "auditStatus");

-- CreateIndex
CREATE INDEX "OracleRequestAudit_chainId_chainlinkRequestId_idx" ON "OracleRequestAudit"("chainId", "chainlinkRequestId");

-- CreateIndex
CREATE INDEX "OracleRequestAudit_chainId_requestId_idx" ON "OracleRequestAudit"("chainId", "requestId");
