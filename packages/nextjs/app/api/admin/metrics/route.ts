import { jsonError, jsonOk } from "~~/lib/flights-api";
import { getAdminMetrics } from "~~/lib/metrics";

export const runtime = "nodejs";

let lastSuccessfulMetrics: Awaited<ReturnType<typeof getAdminMetrics>> | undefined;

export async function GET() {
  try {
    const metrics = await getAdminMetrics();
    lastSuccessfulMetrics = metrics;
    return jsonOk(metrics);
  } catch (error) {
    if (lastSuccessfulMetrics) {
      return jsonOk(lastSuccessfulMetrics);
    }

    return jsonError(error instanceof Error ? error.message : "Failed to load admin metrics.", 500);
  }
}
