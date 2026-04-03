import { jsonError, jsonOk } from "~~/lib/flights-api";
import { listOracleRequestAuditsByPolicyIds } from "~~/lib/oracle-audit";
import scaffoldConfig from "~~/scaffold.config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPolicyIds = searchParams.get("policyIds")?.trim() ?? "";

    if (!rawPolicyIds) {
      return jsonOk({ audits: [] });
    }

    const policyIds = Array.from(
      new Set(
        rawPolicyIds
          .split(",")
          .map(value => value.trim())
          .filter(Boolean)
          .map(value => BigInt(value))
          .filter(value => value > 0n),
      ),
    );

    const targetChainId = scaffoldConfig.targetNetworks[0]?.id;
    if (!targetChainId) {
      return jsonError("Target chain is not configured.", 500);
    }

    const audits = await listOracleRequestAuditsByPolicyIds(targetChainId, policyIds);
    return jsonOk({ audits });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load oracle audits.", 500);
  }
}
