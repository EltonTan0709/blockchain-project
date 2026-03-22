import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { FlightStatus } from "~~/lib/flights";

export type ApiErrorResponse = {
  error: string;
};

export type FlightStatusPatchBody = {
  status: FlightStatus;
  updatedByWallet: string;
  note?: string;
};

export const jsonOk = <T>(data: T, status = 200) => {
  return NextResponse.json({ data }, { status });
};

export const jsonError = (error: string, status: number) => {
  return NextResponse.json<ApiErrorResponse>({ error }, { status });
};

export const isFlightStatus = (value: unknown): value is FlightStatus => {
  return typeof value === "string" && Object.values(FlightStatus).includes(value as FlightStatus);
};

export const parseFlightStatusPatchBody = (body: unknown): FlightStatusPatchBody | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const status = candidate.status;
  const updatedByWallet = candidate.updatedByWallet;
  const note = candidate.note;

  if (!isFlightStatus(status)) {
    return null;
  }

  if (typeof updatedByWallet !== "string" || !isAddress(updatedByWallet)) {
    return null;
  }

  if (note !== undefined && typeof note !== "string") {
    return null;
  }

  return {
    status,
    updatedByWallet,
    note,
  };
};
