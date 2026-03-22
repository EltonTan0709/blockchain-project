import { getFlightById } from "~~/lib/flights";
import { jsonError, jsonOk } from "~~/lib/flights-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    flightId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { flightId } = await params;

  if (!flightId.trim()) {
    return jsonError("Flight id is required", 400);
  }

  try {
    const flight = await getFlightById(flightId);

    if (!flight) {
      return jsonError("Flight not found", 404);
    }

    return jsonOk(flight);
  } catch {
    return jsonError("Failed to load flight", 500);
  }
}
