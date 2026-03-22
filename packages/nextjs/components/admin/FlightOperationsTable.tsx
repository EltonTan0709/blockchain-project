"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";

const FLIGHT_STATUS_OPTIONS = ["SCHEDULED", "DELAYED", "CANCELLED", "DEPARTED", "ARRIVED"] as const;

type FlightStatusValue = (typeof FLIGHT_STATUS_OPTIONS)[number];

type FlightStatusUpdate = {
  id: string;
  flightId: string;
  status: FlightStatusValue;
  note: string | null;
  updatedByWallet: string;
  createdAt: string;
};

type FlightRecord = {
  id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  currentStatus: FlightStatusValue;
  createdAt: string;
  updatedAt: string;
  statusUpdates: FlightStatusUpdate[];
};

type FlightsResponse = {
  data: FlightRecord[];
};

type FlightResponse = {
  data: FlightRecord;
};

type ErrorResponse = {
  error: string;
};

type RowDraft = {
  status: FlightStatusValue;
  note: string;
};

type RowFeedback = {
  type: "success" | "error";
  message: string;
};

const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString();
};

const buildInitialDrafts = (flights: FlightRecord[]) => {
  return flights.reduce<Record<string, RowDraft>>((accumulator, flight) => {
    accumulator[flight.id] = {
      status: flight.currentStatus,
      note: "",
    };

    return accumulator;
  }, {});
};

export const FlightOperationsTable = () => {
  const { address } = useAccount();

  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [feedbackByFlightId, setFeedbackByFlightId] = useState<Record<string, RowFeedback>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [savingFlightId, setSavingFlightId] = useState<string | null>(null);
  const [expandedFlightId, setExpandedFlightId] = useState<string | null>(null);

  const loadFlights = async (showLoadingState = false) => {
    if (showLoadingState) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setLoadingError(null);

    try {
      const response = await fetch("/api/flights", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as FlightsResponse | ErrorResponse;

      if (!response.ok || !("data" in payload)) {
        throw new Error("error" in payload ? payload.error : "Failed to load flights");
      }

      setFlights(payload.data);
      setDrafts(buildInitialDrafts(payload.data));
      setFeedbackByFlightId({});
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : "Failed to load flights");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadFlights(true);
  }, []);

  const updateDraft = (flightId: string, partialDraft: Partial<RowDraft>) => {
    setDrafts(currentDrafts => ({
      ...currentDrafts,
      [flightId]: {
        status: currentDrafts[flightId]?.status ?? "SCHEDULED",
        note: currentDrafts[flightId]?.note ?? "",
        ...partialDraft,
      },
    }));
  };

  const handleSave = async (flightId: string) => {
    const draft = drafts[flightId];

    if (!draft) {
      return;
    }

    if (!address) {
      setFeedbackByFlightId(current => ({
        ...current,
        [flightId]: {
          type: "error",
          message: "Connect the admin wallet before updating a flight.",
        },
      }));
      return;
    }

    setSavingFlightId(flightId);
    setFeedbackByFlightId(current => {
      const next = { ...current };
      delete next[flightId];
      return next;
    });

    try {
      const response = await fetch(`/api/flights/${flightId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: draft.status,
          updatedByWallet: address,
          note: draft.note.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as FlightResponse | ErrorResponse;

      if (!response.ok || !("data" in payload)) {
        throw new Error("error" in payload ? payload.error : "Failed to update flight status");
      }

      setFeedbackByFlightId(current => ({
        ...current,
        [flightId]: {
          type: "success",
          message: "Flight status updated successfully.",
        },
      }));

      await loadFlights(false);
    } catch (error) {
      setFeedbackByFlightId(current => ({
        ...current,
        [flightId]: {
          type: "error",
          message: error instanceof Error ? error.message : "Failed to update flight status",
        },
      }));
    } finally {
      setSavingFlightId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="btn btn-outline btn-sm">
              Back to Dashboard
            </Link>
            <div className="badge badge-outline">Admin Only</div>
          </div>
          <h1 className="mt-4 text-4xl font-bold">Flight Operations</h1>
          <p className="mt-2 text-base-content/70">
            Review seeded flights, change mock statuses, and write status updates through the admin API.
          </p>
        </div>

        <button
          className="btn btn-outline"
          onClick={() => void loadFlights(false)}
          disabled={isRefreshing || isLoading}
        >
          {isRefreshing ? "Refreshing..." : "Refresh Flights"}
        </button>
      </div>

      {loadingError && (
        <div className="alert alert-error">
          <span>{loadingError}</span>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-base-300 bg-base-100 p-10 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="loading loading-spinner loading-md" />
            <span>Loading flight operations data...</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Flight Number</th>
                  <th>Departure Airport</th>
                  <th>Arrival Airport</th>
                  <th>Scheduled Departure</th>
                  <th>Scheduled Arrival</th>
                  <th>Current Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {flights.map(flight => {
                  const draft = drafts[flight.id] ?? { status: flight.currentStatus, note: "" };
                  const feedback = feedbackByFlightId[flight.id];
                  const latestUpdate = flight.statusUpdates[0];
                  const isSaving = savingFlightId === flight.id;
                  const isExpanded = expandedFlightId === flight.id;

                  return (
                    <Fragment key={flight.id}>
                      <tr>
                        <td className="font-semibold">{flight.flightNumber}</td>
                        <td>{flight.departureAirport}</td>
                        <td>{flight.arrivalAirport}</td>
                        <td>{formatDateTime(flight.scheduledDeparture)}</td>
                        <td>{formatDateTime(flight.scheduledArrival)}</td>
                        <td>
                          <div className="badge badge-outline">{flight.currentStatus}</div>
                          {latestUpdate ? (
                            <div className="mt-2 text-xs text-base-content/60">
                              Last update: {formatDateTime(latestUpdate.createdAt)}
                            </div>
                          ) : null}
                        </td>
                        <td className="min-w-[320px]">
                          <div className="flex flex-col gap-3">
                            <select
                              className="select select-bordered w-full"
                              value={draft.status}
                              onChange={event =>
                                updateDraft(flight.id, { status: event.target.value as FlightStatusValue })
                              }
                              disabled={isSaving}
                            >
                              {FLIGHT_STATUS_OPTIONS.map(status => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              value={draft.note}
                              onChange={event => updateDraft(flight.id, { note: event.target.value })}
                              placeholder="Optional note"
                              className="input input-bordered w-full"
                              disabled={isSaving}
                            />

                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <button
                                className="btn btn-primary"
                                onClick={() => void handleSave(flight.id)}
                                disabled={isSaving || !address}
                              >
                                {isSaving ? "Saving..." : "Save Update"}
                              </button>

                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() =>
                                  setExpandedFlightId(current => (current === flight.id ? null : flight.id))
                                }
                              >
                                {isExpanded ? "Hide History" : `Show History (${flight.statusUpdates.length})`}
                              </button>
                            </div>

                            {feedback ? (
                              <span className={`text-sm ${feedback.type === "error" ? "text-error" : "text-success"}`}>
                                {feedback.message}
                              </span>
                            ) : null}

                            {latestUpdate?.note ? (
                              <div className="rounded-xl bg-base-200 p-3 text-xs text-base-content/70">
                                Latest note: {latestUpdate.note}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={7} className="bg-base-200/50">
                            <div className="space-y-3 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm font-semibold">Recent Status History</div>
                                <div className="text-xs text-base-content/60">
                                  Showing {flight.statusUpdates.length} update
                                  {flight.statusUpdates.length === 1 ? "" : "s"}
                                </div>
                              </div>

                              {flight.statusUpdates.length === 0 ? (
                                <div className="rounded-xl bg-base-100 p-4 text-sm text-base-content/70">
                                  No status history recorded yet.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {flight.statusUpdates.map((statusUpdate, index) => (
                                    <div
                                      key={statusUpdate.id}
                                      className={`rounded-xl border p-4 text-sm ${
                                        index === 0 ? "border-primary/30 bg-primary/10" : "border-base-300 bg-base-100"
                                      }`}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                          <div className={`badge ${index === 0 ? "badge-primary" : "badge-outline"}`}>
                                            {statusUpdate.status}
                                          </div>
                                          {index === 0 ? (
                                            <div className="text-xs font-medium text-primary">Latest</div>
                                          ) : null}
                                        </div>
                                        <div className="text-xs text-base-content/60">
                                          {formatDateTime(statusUpdate.createdAt)}
                                        </div>
                                      </div>

                                      <div className="mt-3 grid gap-2 text-xs text-base-content/70 md:grid-cols-2">
                                        <div>
                                          <span className="font-semibold">Updated By:</span>{" "}
                                          {statusUpdate.updatedByWallet}
                                        </div>
                                        <div>
                                          <span className="font-semibold">Flight ID:</span> {statusUpdate.flightId}
                                        </div>
                                      </div>

                                      <div className="mt-3 rounded-lg bg-base-200 p-3 text-xs text-base-content/80">
                                        <span className="font-semibold">Note:</span>{" "}
                                        {statusUpdate.note?.trim() ? statusUpdate.note : "No note provided."}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {flights.length === 0 && (
            <div className="p-6 text-sm text-base-content/70">No flights found in the database.</div>
          )}
        </div>
      )}
    </div>
  );
};
