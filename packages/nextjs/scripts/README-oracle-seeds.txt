Use `yarn workspace @se-2/nextjs exec tsx scripts/seedSplitVoteFlight.ts` to insert a single
future flight (`CX715`) that demonstrates oracle source disagreement:

- Flight Status Board: Scheduled
- Latest Ops Update: Delayed by 45 minutes
- History Parser: Delayed by 45 minutes

This gives a clean 2-of-3 majority vote without wiping the rest of the flight dataset.
