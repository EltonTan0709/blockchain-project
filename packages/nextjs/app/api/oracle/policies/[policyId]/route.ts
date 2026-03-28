import { jsonError, jsonOk } from "~~/lib/flights-api";
import { getOracleDecisionForPolicy } from "~~/lib/oracle";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    policyId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { policyId } = await params;

  try {
    const parsedPolicyId = BigInt(policyId);

    if (parsedPolicyId <= 0n) {
      return jsonError("Policy id must be greater than zero.", 400);
    }

    const decision = await getOracleDecisionForPolicy(parsedPolicyId);
    return jsonOk(decision);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to evaluate policy for oracle.", 500);
  }
}
