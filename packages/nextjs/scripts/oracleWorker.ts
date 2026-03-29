import { processDueOracleRequests } from "../lib/oracle-automation";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const POLL_INTERVAL_MS = Number(process.env.ORACLE_WORKER_POLL_INTERVAL_MS ?? "15000");
const runOnce = process.argv.includes("--once");

const sleep = (durationMs: number) => new Promise(resolve => setTimeout(resolve, durationMs));

const runCycle = async () => {
  const startedAt = new Date();
  const result = await processDueOracleRequests();

  console.log(
    `[oracle-worker] ${startedAt.toISOString()} scanned=${result.scannedPolicies} queued=${result.queuedPolicies} requested=${result.requestedPolicies} fulfilled=${result.fulfilledPolicies} failed=${result.failedPolicies} expired=${result.expiredPolicies}`,
  );
};

const main = async () => {
  do {
    try {
      await runCycle();
    } catch (error) {
      console.error("[oracle-worker] cycle failed", error);
    }

    if (!runOnce) {
      await sleep(POLL_INTERVAL_MS);
    }
  } while (!runOnce);
};

void main();
