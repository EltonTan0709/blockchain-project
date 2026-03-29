import { NextResponse } from "next/server";
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
      return NextResponse.json({ error: "Policy id must be greater than zero." }, { status: 400 });
    }

    const decision = await getOracleDecisionForPolicy(parsedPolicyId);

    return NextResponse.json(
      {
        policyId: decision.policy.policyId,
        outcome: decision.oracle.outcome,
        delayMinutes: decision.oracle.delayMinutes,
        payoutEligible: decision.oracle.payoutEligible,
        reason: decision.oracle.reason,
        winningVotes: decision.oracle.winningVotes,
        totalVotes: decision.oracle.totalVotes,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to evaluate policy for Chainlink Functions.",
      },
      { status: 500 },
    );
  }
}
