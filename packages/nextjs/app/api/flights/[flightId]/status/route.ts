import { getFlightById, updateFlightStatus } from "~~/lib/flights";
import { jsonError, jsonOk, parseFlightStatusPatchBody } from "~~/lib/flights-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    flightId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { flightId } = await params;

  if (!flightId.trim()) {
    return jsonError("Flight id is required", 400);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsedBody = parseFlightStatusPatchBody(body);

  if (!parsedBody) {
    return jsonError("Body must include status, updatedByWallet, and optional note", 400);
  }

  try {
    const existingFlight = await getFlightById(flightId);

    if (!existingFlight) {
      return jsonError("Flight not found", 404);
    }

    const updatedFlight = await updateFlightStatus(
      flightId,
      parsedBody.status,
      parsedBody.updatedByWallet,
      parsedBody.note,
    );

    return jsonOk(updatedFlight);
  } catch {
    return jsonError("Failed to update flight status", 500);
  }
}
