"use client";

import { useState } from "react";

type OracleDecisionResponse = {
  data: {
    policy: {
      policyId: string;
      flightNumber: string;
      departureTimestamp: string;
      policyType: number;
      status: number;
      delayThresholdMinutes: string;
    };
    flight: {
      id: string;
      flightNumber: string;
      currentStatus: string;
      scheduledDeparture: string;
      latestNote: string | null;
    };
    oracle: {
      outcome: number;
      delayMinutes: number;
      payoutEligible: boolean;
      reason: string;
    };
  };
};

export const OracleAutomationPanel = () => {
  const [policyId, setPolicyId] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<OracleDecisionResponse["data"] | null>(null);

  const handleEvaluate = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/oracle/policies/${policyId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as OracleDecisionResponse | { error?: string };

      if (!response.ok || !("data" in payload)) {
        throw new Error("error" in payload ? payload.error : "Failed to evaluate policy");
      }

      setDecision(payload.data);
    } catch (caughtError) {
      setDecision(null);
      setError(caughtError instanceof Error ? caughtError.message : "Failed to evaluate policy");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="rounded-[2rem] border border-base-300 bg-base-100 p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Oracle Automation Mock</h1>
        <p className="mt-3 max-w-3xl text-base-content/70">
          This screen simulates the Postgres-to-oracle decision step after policy purchase. It reads the on-chain
          policy, checks the flight status stored in Postgres, and shows the payout decision that the oracle should
          fulfill.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="number"
            min="1"
            value={policyId}
            onChange={event => setPolicyId(event.target.value)}
            className="input input-bordered w-full rounded-2xl sm:max-w-xs"
            placeholder="Policy ID"
          />
          <button className="btn btn-primary rounded-2xl" onClick={() => void handleEvaluate()} disabled={loading}>
            {loading ? "Evaluating..." : "Run Mock Oracle Check"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-error rounded-2xl">
          <span>{error}</span>
        </div>
      ) : null}

      {decision ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-base-content/50">Policy</div>
            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="font-semibold">Policy ID:</span> {decision.policy.policyId}
              </div>
              <div>
                <span className="font-semibold">Flight:</span> {decision.policy.flightNumber}
              </div>
              <div>
                <span className="font-semibold">Policy Type:</span>{" "}
                {decision.policy.policyType === 0 ? "Flight Delay" : "Flight Cancellation"}
              </div>
              <div>
                <span className="font-semibold">Delay Threshold:</span>{" "}
                {Number(decision.policy.delayThresholdMinutes) / 60} hours
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-base-content/50">
              Postgres Flight
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="font-semibold">Status:</span> {decision.flight.currentStatus}
              </div>
              <div>
                <span className="font-semibold">Scheduled Departure:</span>{" "}
                {new Date(decision.flight.scheduledDeparture).toLocaleString()}
              </div>
              <div>
                <span className="font-semibold">Latest Note:</span> {decision.flight.latestNote ?? "No note"}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-base-content/50">
              Oracle Decision
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="font-semibold">Outcome Code:</span> {decision.oracle.outcome}
              </div>
              <div>
                <span className="font-semibold">Delay Minutes:</span> {decision.oracle.delayMinutes}
              </div>
              <div>
                <span className="font-semibold">Payout:</span>{" "}
                {decision.oracle.payoutEligible ? "Eligible" : "Not eligible"}
              </div>
              <div>
                <span className="font-semibold">Reason:</span> {decision.oracle.reason}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
