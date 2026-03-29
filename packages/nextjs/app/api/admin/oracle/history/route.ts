import { jsonError, jsonOk } from "~~/lib/flights-api";
import { listOracleRequestAudits, summarizeOracleAudits } from "~~/lib/oracle-audit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "25");
    const audits = await listOracleRequestAudits(limit);

    return jsonOk({
      audits,
      summary: summarizeOracleAudits(audits),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load oracle history.", 500);
  }
}
