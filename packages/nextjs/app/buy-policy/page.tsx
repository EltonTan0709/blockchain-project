import { Suspense } from "react";
import { BuyPolicyForm } from "~~/components/BuyPolicyForm";

const BuyPolicyPage = () => {
  return (
    <div className="px-6 py-10">
      <Suspense
        fallback={
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-base-300 bg-base-100 p-8 text-base-content/60 shadow-sm">
            Loading the policy purchase form...
          </div>
        }
      >
        <BuyPolicyForm />
      </Suspense>
    </div>
  );
};

export default BuyPolicyPage;
