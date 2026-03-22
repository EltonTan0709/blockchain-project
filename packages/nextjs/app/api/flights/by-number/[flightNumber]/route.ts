import { getFlightByFlightNumber } from "~~/lib/flights";
import { jsonError, jsonOk } from "~~/lib/flights-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    flightNumber: string;
  }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { flightNumber } = await params;
  const normalizedFlightNumber = flightNumber.trim();

  if (!normalizedFlightNumber) {
    return jsonError("Flight number is required", 400);
  }

  try {
    const flights = await getFlightByFlightNumber(normalizedFlightNumber);

    return jsonOk(flights);
  } catch {
    return jsonError("Failed to load flights", 500);
  }
}
