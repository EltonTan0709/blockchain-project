"use client";

import Link from "next/link";
import { POLICY_PLANS, getPolicyTypeLabel, getTriggerLabel } from "~~/utils/scaffold-eth/policyPlans";

const InsurancePlansPage = () => {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold">Choose Your Insurance Plan</h1>
        <p className="mt-3 text-base-content/70">Select a flight insurance plan before proceeding to purchase.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {POLICY_PLANS.map(plan => {
          const href = `/buy-policy?planId=${encodeURIComponent(plan.id)}&policyType=${plan.policyType}&coverage=${plan.coverage}&premium=${plan.premium}&duration=${plan.duration}`;

          return (
            <div
              key={plan.id}
              className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="mb-3">
                <div className="badge badge-primary badge-outline">{getPolicyTypeLabel(plan.policyType)}</div>
              </div>

              <h2 className="text-2xl font-bold">{plan.title}</h2>
              <p className="mt-3 min-h-[72px] text-sm text-base-content/70">{plan.description}</p>

              <div className="mt-6 space-y-3 rounded-2xl bg-base-200 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Coverage</span>
                  <span>{plan.coverage} USDC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Premium</span>
                  <span>{plan.premium} USDC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Trigger</span>
                  <span className="text-right">{getTriggerLabel(plan)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Policy Window</span>
                  <span>{plan.duration} hours</span>
                </div>
              </div>

              <div className="mt-6">
                <Link href={href} className="btn btn-primary w-full">
                  Select Plan
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InsurancePlansPage;
