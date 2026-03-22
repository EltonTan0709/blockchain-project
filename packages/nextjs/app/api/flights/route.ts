import { listFlights } from "~~/lib/flights";
import { jsonError, jsonOk } from "~~/lib/flights-api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const flights = await listFlights();

    return jsonOk(flights);
  } catch {
    return jsonError("Failed to load flights", 500);
  }
}
