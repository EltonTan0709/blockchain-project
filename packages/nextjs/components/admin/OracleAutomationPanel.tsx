"use client";

import { useEffect, useMemo, useState } from "react";

type OracleAuditMetadata = {
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

type OracleAuditRecord = {
  id: string;
  chainId: number;
  policyId: string;
  requestId: string | null;
  chainlinkRequestId: string | null;
  auditStatus: "REQUESTED" | "AWAITING_CHAINLINK" | "FULFILLED" | "FAILED" | "EXPIRED";
  usedChainlink: boolean;
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

type OracleHistoryResponse = {
  data: {
    audits: OracleAuditRecord[];
    summary: Record<OracleAuditRecord["auditStatus"], number>;
    generatedAt: string;
  };
};

type OracleDisplayStatus = "Pending Callback" | "Paid Out" | "No Payout" | "Failed" | "Expired";

const HISTORY_REFRESH_INTERVAL_MS = 10_000;

const formatFlightStatusLabel = (flightStatus: string | null | undefined) => {
  if (!flightStatus) {
    return "Unknown";
  }

  switch (flightStatus) {
    case "SCHEDULED":
      return "Scheduled";
    case "DELAYED":
      return "Delayed";
    case "CANCELLED":
      return "Cancelled";
    case "DEPARTED":
      return "Departed";
    case "ARRIVED":
      return "Arrived";
    default:
      return flightStatus;
  }
};

const getOutcomeLabel = (outcome: number | null | undefined, flightStatus?: string | null) => {
  switch (outcome) {
    case 1:
      return "On Time";
    case 2:
      return "Delayed";
    case 3:
      return "Cancelled";
    default:
      if (flightStatus === "SCHEDULED") {
        return "Scheduled";
      }
      if (flightStatus === "DEPARTED" || flightStatus === "ARRIVED") {
        return "No disruption";
      }
      return "Unresolved";
  }
};

const getDisplayStatus = (audit: OracleAuditRecord): OracleDisplayStatus => {
  switch (audit.auditStatus) {
    case "FULFILLED":
      return audit.payoutExecuted ? "Paid Out" : "No Payout";
    case "FAILED":
      return "Failed";
    case "EXPIRED":
      return "Expired";
    case "AWAITING_CHAINLINK":
    case "REQUESTED":
    default:
      return "Pending Callback";
  }
};

const getDisplayTone = (displayStatus: OracleDisplayStatus) => {
  switch (displayStatus) {
    case "Paid Out":
      return "badge-success";
    case "No Payout":
      return "badge-neutral";
    case "Failed":
      return "badge-error";
    case "Expired":
      return "badge-warning";
    case "Pending Callback":
    default:
      return "badge-info";
  }
};

const getSourceDelayLabel = (outcome: number, delayMinutes: number) => {
  if (outcome === 2) {
    return `Delay: ${delayMinutes} minutes`;
  }

  return "Delay: not applied";
};

const SummaryCard = ({ label, value }: { label: string; value: number }) => {
  return (
    <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">{label}</div>
      <div className="mt-3 text-3xl font-black">{value}</div>
    </div>
  );
};

export const OracleAutomationPanel = () => {
  const [audits, setAudits] = useState<OracleAuditRecord[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const loadHistory = async () => {
      try {
        const response = await fetch("/api/admin/oracle/history?limit=30", {
          cache: "no-store",
        });
        const payload = (await response.json()) as OracleHistoryResponse | { error?: string };

        if (!response.ok || !("data" in payload)) {
          throw new Error("error" in payload ? payload.error : "Failed to load oracle history.");
        }

        if (isCancelled) {
          return;
        }

        setAudits(payload.data.audits);
        setGeneratedAt(payload.data.generatedAt);
        setSelectedAuditId(currentSelectedAuditId => currentSelectedAuditId ?? payload.data.audits[0]?.id ?? null);
        setError("");
      } catch (caughtError) {
        if (!isCancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to load oracle history.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    const intervalId = window.setInterval(() => {
      void loadHistory();
    }, HISTORY_REFRESH_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedAudit = useMemo(
    () => audits.find(audit => audit.id === selectedAuditId) ?? audits[0] ?? null,
    [audits, selectedAuditId],
  );

  const displaySummary = useMemo(() => {
    return audits.reduce<Record<OracleDisplayStatus, number>>(
      (summary, audit) => {
        summary[getDisplayStatus(audit)] += 1;
        return summary;
      },
      {
        "Pending Callback": 0,
        "Paid Out": 0,
        "No Payout": 0,
        Failed: 0,
        Expired: 0,
      },
    );
  }, [audits]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Oracle Operations</h1>
        <p className="mt-3 max-w-4xl text-base-content/70">
          This page keeps the oracle decision history concise: final result, supporting vote snapshot, and proof of
          whether the run used Chainlink Functions or the local simulated path.
        </p>
        <div className="mt-4 text-xs text-base-content/55">
          Last history refresh: {generatedAt ? new Date(generatedAt).toLocaleString() : "Loading..."}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Pending Callback" value={displaySummary["Pending Callback"]} />
        <SummaryCard label="Paid Out" value={displaySummary["Paid Out"]} />
        <SummaryCard label="No Payout" value={displaySummary["No Payout"]} />
        <SummaryCard label="Failed" value={displaySummary.Failed} />
      </div>

      {error ? (
        <div className="alert alert-error rounded-2xl">
          <span>{error}</span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm text-base-content/60">
          Loading oracle history...
        </div>
      ) : null}

      {!isLoading && audits.length === 0 ? (
        <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm text-base-content/60">
          No oracle audit records yet. Once the worker processes a due policy, history will appear here.
        </div>
      ) : null}

      {audits.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-base-content/45">Recent History</div>
            <div className="mt-4 space-y-3">
              {audits.map(audit => {
                const displayStatus = getDisplayStatus(audit);

                return (
                  <button
                    key={audit.id}
                    type="button"
                    onClick={() => setSelectedAuditId(audit.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      audit.id === selectedAudit?.id
                        ? "border-primary/40 bg-primary/5"
                        : "border-base-300/70 bg-base-200/30 hover:border-primary/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold">
                          Policy #{audit.policyId}
                          {audit.flightNumber ? ` · ${audit.flightNumber}` : ""}
                        </div>
                        <div className="mt-1 text-sm text-base-content/60">
                          Updated {new Date(audit.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className={`badge ${getDisplayTone(displayStatus)}`}>{displayStatus}</div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-base-content/70 sm:grid-cols-3">
                      <div>Outcome: {getOutcomeLabel(audit.outcome, audit.flightStatus)}</div>
                      <div>Delay: {audit.delayMinutes ?? 0} min</div>
                      <div>
                        Payout: {audit.payoutExecuted ? "Paid out" : audit.payoutEligible ? "Eligible" : "No payout"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-base-content/45">Audit Detail</div>

            {selectedAudit ? (
              <div className="mt-4 space-y-5 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="font-semibold">Decision Status:</span>{" "}
                    <span className={`badge ${getDisplayTone(getDisplayStatus(selectedAudit))}`}>
                      {getDisplayStatus(selectedAudit)}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">Policy ID:</span> {selectedAudit.policyId}
                  </div>
                  <div>
                    <span className="font-semibold">Flight:</span> {selectedAudit.flightNumber ?? "Unknown"}
                  </div>
                  <div>
                    <span className="font-semibold">Flight Status:</span>{" "}
                    {formatFlightStatusLabel(selectedAudit.flightStatus)}
                  </div>
                  <div>
                    <span className="font-semibold">Outcome:</span>{" "}
                    {getOutcomeLabel(selectedAudit.outcome, selectedAudit.flightStatus)}
                  </div>
                  <div>
                    <span className="font-semibold">Delay Minutes:</span> {selectedAudit.delayMinutes ?? 0}
                  </div>
                  {selectedAudit.payoutExecuted || selectedAudit.payoutAmount !== "0" ? (
                    <div>
                      <span className="font-semibold">Payout Amount:</span> {selectedAudit.payoutAmount ?? "0"} USDC
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-base-300/70 bg-base-200/30 p-4 text-base-content/70">
                  <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">Oracle Proof</div>
                  <div className="mt-3 space-y-2">
                    <div>
                      <span className="font-semibold">Execution Mode:</span>{" "}
                      {selectedAudit.usedChainlink ? "Chainlink Functions" : "Simulated consensus"}
                    </div>
                    <div>
                      <span className="font-semibold">Vote:</span> {selectedAudit.metadata?.winningVotes ?? 0}/
                      {selectedAudit.metadata?.totalVotes ?? 0}
                    </div>
                    {selectedAudit.chainlinkRequestId ? (
                      <div className="break-all">
                        <span className="font-semibold">Chainlink Request ID:</span> {selectedAudit.chainlinkRequestId}
                      </div>
                    ) : null}
                    <div>
                      <span className="font-semibold">Reason:</span>{" "}
                      {selectedAudit.metadata?.reason ?? "No reason stored"}
                    </div>
                  </div>
                </div>

                {selectedAudit.latestNote ? (
                  <div className="rounded-2xl border border-base-300/70 bg-base-200/30 p-4 text-base-content/70">
                    <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">Latest Note</div>
                    <div className="mt-2">{selectedAudit.latestNote}</div>
                  </div>
                ) : null}

                {selectedAudit.metadata?.sources?.length ? (
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-base-content/45">Source Vote Snapshot</div>
                    {selectedAudit.metadata.sources.map(source => (
                      <div key={source.sourceId} className="rounded-2xl border border-base-300/70 bg-base-200/30 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">{source.sourceLabel}</div>
                          <div className="badge badge-outline">
                            {getOutcomeLabel(source.outcome, selectedAudit.flightStatus)}
                          </div>
                        </div>
                        <div className="mt-2 text-base-content/70">
                          {getSourceDelayLabel(source.outcome, source.delayMinutes)}
                        </div>
                        <div className="mt-1 text-base-content/70">
                          Payout: {source.payoutEligible ? "Eligible" : "Not eligible"}
                        </div>
                        <div className="mt-2 text-xs leading-5 text-base-content/60">{source.reason}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {selectedAudit.errorMessage ? (
                  <div className="rounded-2xl border border-error/20 bg-error/5 p-4 text-error">
                    <div className="font-semibold">Worker Error</div>
                    <div className="mt-2 text-sm">{selectedAudit.errorMessage}</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 text-base-content/60">Select an audit record to inspect it.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
