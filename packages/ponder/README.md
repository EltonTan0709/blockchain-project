# Ponder Indexer

This workspace indexes your deployed `InsurancePool`, `PolicyManager`, and `OracleCoordinator` contracts into Postgres so gas analytics no longer depend on live request-time RPC scans.

## What It Stores

The current scaffold writes one row per gas-relevant transaction into `gas_transactions`, covering:

- `depositLiquidity`
- `buyPolicy`
- `performUpkeep` / `requestOracleCheck`
- `fulfillOracleCheck`

Each row stores the transaction hash, block/timestamp, gas used, effective gas price, total fee paid, and the key event args needed for admin analytics.

## Environment

Create `packages/ponder/.env.local` from `.env.example` and set:

- `PONDER_RPC_URL_11155111`: your Sepolia RPC URL
- `DATABASE_URL`: the same Postgres instance you already use for Prisma is fine
- `DATABASE_SCHEMA`: recommended value is `ponder` so Ponder stays isolated from Prisma tables

If you want the frontend to talk to a local Ponder server later, add this to `packages/nextjs/.env.local`:

```bash
NEXT_PUBLIC_PONDER_URL=http://localhost:42069
```

## Commands

From the repo root:

```bash
yarn ponder:dev
yarn ponder:codegen
yarn ponder:db
```

`yarn ponder:dev` starts the indexer and GraphQL explorer on the default Ponder port.

## Next Step

Once this indexer is running and synced, we can switch the admin gas metrics in `packages/nextjs/lib/metrics.ts` to read Postgres-backed Ponder data instead of scanning Sepolia RPC on demand.
