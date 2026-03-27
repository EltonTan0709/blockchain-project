"use client";

import Link from "next/link";
import { ArrowRightIcon, CheckCircleIcon } from "@heroicons/react/24/solid";
import { POLICY_PLANS, getPolicyTypeLabel, getTriggerLabel } from "~~/utils/scaffold-eth/policyPlans";

const getPlanAccentClasses = (index: number) => {
  const accents = [
    {
      pill: "bg-info/15 text-info-content",
      border: "border-info/20",
      soft: "bg-info/6",
      button: "btn-info",
    },
    {
      pill: "bg-secondary/18 text-secondary-content",
      border: "border-secondary/20",
      soft: "bg-secondary/8",
      button: "btn-secondary",
    },
    {
      pill: "bg-success/15 text-success-content",
      border: "border-success/20",
      soft: "bg-success/8",
      button: "btn-success",
    },
    {
      pill: "bg-warning/20 text-warning-content",
      border: "border-warning/20",
      soft: "bg-warning/10",
      button: "btn-warning",
    },
  ];

  return accents[index % accents.length];
};

const InsurancePlansPage = () => {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-base-content/45">Plan Comparison</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Choose The Right Flight Cover</h1>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        {POLICY_PLANS.map((plan, index) => {
          const href = `/buy-policy?planId=${encodeURIComponent(plan.id)}&policyType=${plan.policyType}&coverage=${plan.coverage}&premium=${plan.premium}&duration=${plan.duration}`;
          const accent = getPlanAccentClasses(index);

          return (
            <article
              key={plan.id}
              className={`flex h-full min-h-[32rem] flex-col rounded-[1.75rem] border bg-base-100 p-5 shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl ${accent.border}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`inline-flex rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${accent.pill}`}
                >
                  {getPolicyTypeLabel(plan.policyType)}
                </div>
                <div className={`rounded-2xl px-3 py-2 text-right ${accent.soft}`}>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-base-content/45">Premium</div>
                  <div className="mt-1 text-lg font-black">{plan.premium} USDC</div>
                </div>
              </div>

              <div className="mt-4">
                <h2 className="text-2xl font-bold leading-tight">{plan.title}</h2>
                <p className="mt-3 text-sm leading-7 text-base-content/68">{plan.description}</p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-base-200/80 p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-base-content/45">Coverage</div>
                  <div className="mt-2 text-xl font-bold">{plan.coverage} USDC</div>
                </div>
                <div className="rounded-2xl bg-base-200/80 p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-base-content/45">Window</div>
                  <div className="mt-2 text-xl font-bold">{plan.duration}h</div>
                </div>
              </div>

              <div className="mt-5 space-y-3 rounded-3xl bg-base-200/55 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <div>
                    <div className="font-semibold">Trigger</div>
                    <div className="text-base-content/65">{getTriggerLabel(plan)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <div>
                    <div className="font-semibold">Best for</div>
                    <div className="text-base-content/65">
                      {plan.policyType === 0 ? "Long-delay protection" : "Cancellation-focused protection"}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <div>
                    <div className="font-semibold">Checkout</div>
                    <div className="text-base-content/65">Plan details are preloaded into purchase</div>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-6">
                <Link href={href} className={`btn w-full rounded-2xl border-0 text-base ${accent.button}`}>
                  Select Plan
                  <ArrowRightIcon className="h-5 w-5" />
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
};

export default InsurancePlansPage;
