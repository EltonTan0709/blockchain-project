# FlightSure MVP

## Overview

FlightSure MVP is a flight-insurance DApp built as a hybrid Web3 application. Travelers can browse predefined plans, buy policies with a mock USDC token, and view policies on-chain. Admin workflows manage seeded flight data in Postgres, monitor dashboard metrics, and review oracle and settlement audit history.

The repository combines smart contracts in `packages/hardhat`, a Next.js frontend in `packages/nextjs`, and an optional Ponder indexer in `packages/ponder`.

The current checked-in frontend configuration targets Sepolia. Local Hardhat scripts are still present, but Sepolia is the network configured in `packages/nextjs/scaffold.config.ts`.

## Current implementation status

### Fully implemented

- On-chain policy purchase, policy storage, and payout execution through `MockUSDC`, `InsurancePool`, `PolicyManager`, and `OracleCoordinator`.
- Traveler pages for plan browsing, buying a policy, and viewing policies.
- Off-chain flight storage and flight status history with Prisma and Postgres.
- Admin dashboard metrics built from on-chain reads plus off-chain data.
- Oracle worker audit history stored in Postgres.

### Partially implemented

- Liquidity deposit flow is real, but the current UI exposes it only to the configured admin wallet.
- Oracle processing depends on a dedicated worker and environment configuration.
- Admin access is enforced in the frontend, but server-side route protection is limited.
- Frontend and backend are wired for Sepolia by default rather than a local-chain-first workflow.

### Mock/manual

- The payment token is `MockUSDC`, not a production stablecoin.
- Flight data is seeded and manually updated through the admin interface.
- Oracle decisions are derived from repository-controlled off-chain flight data and internal voting logic.
- Settlement is worker-driven rather than user-claimed.

### Optional infrastructure

- Ponder indexes gas-related events into Postgres for analytics, but the core application can run without it.
- `ChainlinkDemoOracleConsumer` adds a demo Chainlink Functions path, but it still reads this app's own oracle API and is not evidence of a fully decentralized live oracle system.

## Key features

- Traveler wallet connection with RainbowKit and Wagmi.
- Predefined flight insurance plans for delay and cancellation coverage.
- Flight lookup by flight number before purchase.
- MockUSDC approval and policy purchase flow.
- On-chain policy retrieval in "My Policies".
- Insurance pool deposits and payout accounting.
- Admin flight status management with status history.
- Automated oracle worker with audit logging.
- Admin dashboard for pool, policy, settlement, and gas metrics.
- Optional Ponder-based gas analytics.

## Architecture overview

| Layer           | Purpose                                                           | Main location                                       |
| --------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| Smart contracts | Policy storage, liquidity, oracle request state, payouts          | `packages/hardhat/contracts`                        |
| Frontend        | Wallet UI, traveler flows, admin pages                            | `packages/nextjs/app`, `packages/nextjs/components` |
| Server/API      | Flight lookup, flight updates, oracle decision endpoints, metrics | `packages/nextjs/app/api`, `packages/nextjs/lib`    |
| Database        | Flights, status updates, oracle audit records                     | `packages/nextjs/prisma`                            |
| Indexer         | Optional gas and event analytics                                  | `packages/ponder`                                   |

## Smart contract modules

- `MockUSDC`
  - Owner-mintable ERC-20 test token with 6 decimals.
  - Used for premiums, liquidity deposits, and payouts.
- `InsurancePool`
  - Stores liquidity and accounting totals.
  - Accepts deposits, records premiums, and executes payouts.
- `PolicyManager`
  - Sells policies, stores policy data on-chain, and resolves outcomes after oracle fulfillment.
  - Supports a demo oracle timing mode through `setOracleEvaluationConfig`.
- `OracleCoordinator`
  - Tracks oracle requests by policy ID.
  - Restricts request and fulfillment roles and forwards oracle results into `PolicyManager`.
- `ChainlinkDemoOracleConsumer`
  - Optional/demo contract that can request oracle results from `/api/oracle/functions/[policyId]`.
  - Can also accept simulated callback execution from the configured worker wallet.
- `YourContract`
  - Scaffold-ETH example contract still present in the repository.
  - Not part of the flight insurance MVP.

## Frontend modules

- `/`
  - Landing page with separate traveler and admin navigation paths.
- `/insurance-plans`
  - Plan comparison page backed by static plan definitions.
- `/buy-policy`
  - Traveler purchase form with flight lookup, MockUSDC approval, and `buyPolicy` submission.
- `/my-policies`
  - Reads purchased policies directly from `PolicyManager`.
- `/admin`
  - Admin dashboard for pool, policy, settlement, and gas metrics.
- `/admin/flights`
  - Flight operations page for status updates and flight status history.
- `/admin/oracle`
  - Oracle operations page that shows stored oracle audit history and decision details.
- `/pool`
  - Liquidity deposit page.
  - Frontend access is currently admin-gated.
- Common UI
  - `Header` shows role-aware navigation.
  - `AdminRouteGuard` uses `NEXT_PUBLIC_ADMIN_WALLET` for client-side admin gating.
- Scaffold leftovers
  - `/debug` and `/blockexplorer` remain from Scaffold-ETH and are not part of the core insurance workflow.

## Backend/database modules

- Next.js route handlers in `packages/nextjs/app/api` provide:
  - flight listing
  - flight lookup by ID
  - flight lookup by flight number
  - flight status updates
  - oracle decision endpoints
  - admin metrics
  - oracle history
- Prisma/Postgres models in `packages/nextjs/prisma/schema.prisma`:
  - `Flight`
  - `FlightStatusUpdate`
  - `OracleRequestAudit`
- Seed data in `packages/nextjs/prisma/seed.ts` loads sample flights such as `SQ318`, `BA12`, `UA1`, `EK405`, `NH802`, `QF72`, and `LH779`.
- Server utilities in `packages/nextjs/lib` handle:
  - flight reads and status writes
  - oracle decision calculation
  - oracle worker automation
  - oracle audit serialization
  - admin metrics aggregation

## Oracle and settlement flow

1. A traveler buys a policy on-chain through `PolicyManager`.
2. The policy becomes oracle-ready based on departure time or the demo delay setting in `PolicyManager`.
3. The oracle worker scans due policies and fetches the matching flight from Postgres.
4. The server calculates a decision using three internal evidence sources:
   - `Flight.currentStatus`
   - the latest flight status update
   - parsed status history
5. The worker either:
   - submits a simulated callback through `ChainlinkDemoOracleConsumer.submitConsensusResult`, or
   - requests Chainlink Functions through `requestPolicyEvaluation` when `CHAINLINK_FUNCTIONS_ENABLED=true`
6. `OracleCoordinator` records fulfillment and calls `PolicyManager.resolvePolicyFromOracle`.
7. If the policy is eligible, `InsurancePool` transfers the payout in MockUSDC.
8. Oracle request history and decision snapshots are stored in `OracleRequestAudit`.

## Tech stack

| Layer                    | Technology                                               |
| ------------------------ | -------------------------------------------------------- |
| Workspace                | Yarn 3 workspaces                                        |
| Smart contract framework | Hardhat, hardhat-deploy                                  |
| Contract language        | Solidity 0.8.x                                           |
| Contract libraries       | OpenZeppelin, Chainlink contracts                        |
| Frontend                 | Next.js 15, React 19, TypeScript                         |
| Wallet/web3              | RainbowKit, Wagmi, Viem                                  |
| Styling                  | Tailwind CSS 4, DaisyUI 5                                |
| Backend/API              | Next.js route handlers, server-only TypeScript utilities |
| Database                 | PostgreSQL                                               |
| ORM                      | Prisma 6                                                 |
| Indexing/analytics       | Ponder, Hono, GraphQL                                    |
| Testing                  | Hardhat test runner, Chai, gas reporter                  |

## Setup and installation

### Prerequisites

- Node.js `>=20.18.3`
- Yarn `3.2.3` or compatible Corepack-managed Yarn
- A PostgreSQL database
- A funded deployer wallet if you are using Sepolia
- Optional: a dedicated oracle worker wallet

### Install dependencies

```bash
yarn install
```

### Create local environment files

Use the example files as the source of required variable names:

- `packages/hardhat/.env.example`
- `packages/nextjs/.env.example`
- `packages/ponder/.env.example` for optional analytics

### Prepare the database

```bash
yarn workspace @se-2/nextjs prisma:generate
yarn workspace @se-2/nextjs prisma:migrate:dev
yarn workspace @se-2/nextjs prisma:seed
```

### Prepare a deployer account

Use one of the repository scripts:

```bash
yarn account:generate
```

Or import an existing key:

```bash
yarn account:import
```

### Deploy contracts

The checked-in frontend targets Sepolia, so the most accurate repo-aligned deployment path is:

```bash
yarn deploy --network sepolia
```

Optional post-deploy maintenance commands:

```bash
yarn configure:oracle-worker
yarn configure:chainlink-functions
```

If you want to run the application against a local Hardhat network instead, update `packages/nextjs/scaffold.config.ts` and the relevant deployment and network settings first. Local chain scripts still exist, but local Hardhat is not the current checked-in default target.

## Environment variables required

### `packages/nextjs`

| Variable                                | Purpose                                                                     | Status                                  |
| --------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| `DATABASE_URL`                          | Prisma/Postgres connection                                                  | Required                                |
| `NEXT_PUBLIC_ADMIN_WALLET`              | Client-side admin UI gating                                                 | Required for admin pages                |
| `NEXT_PUBLIC_ALCHEMY_API_KEY`           | Sepolia RPC access for frontend reads                                       | Recommended                             |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect and RainbowKit configuration                                  | Recommended                             |
| `ORACLE_AUTOMATION_PRIVATE_KEY`         | Dedicated worker signer for oracle processing                               | Required if running the worker          |
| `ORACLE_WORKER_POLL_INTERVAL_MS`        | Oracle worker polling interval                                              | Optional                                |
| `CHAINLINK_FUNCTIONS_ENABLED`           | Switch between simulated callback mode and Chainlink Functions request mode | Optional                                |
| `PONDER_DATABASE_SCHEMA`                | Schema name for Ponder gas tables                                           | Optional                                |
| `NEXT_PUBLIC_PONDER_URL`                | Ponder GraphQL URL                                                          | Optional and not required for core flow |

### `packages/hardhat`

| Variable                                 | Purpose                                                    | Status                                         |
| ---------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `DEPLOYER_PRIVATE_KEY_ENCRYPTED`         | Encrypted deployer key for Hardhat scripts                 | Required for deployment                        |
| `ALCHEMY_API_KEY`                        | RPC access for remote networks such as Sepolia             | Recommended                                    |
| `ETHERSCAN_V2_API_KEY`                   | Contract verification                                      | Optional                                       |
| `ORACLE_DEMO_MODE`                       | Enables demo oracle timing in `PolicyManager`              | Optional                                       |
| `ORACLE_DEMO_DELAY_SECONDS`              | Delay before a policy becomes oracle-ready in demo mode    | Optional                                       |
| `ORACLE_AUTOMATION_ADDRESS`              | Address allowed to trigger oracle upkeep and callback flow | Recommended                                    |
| `CHAINLINK_FUNCTIONS_ROUTER`             | Demo consumer router address                               | Optional                                       |
| `CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID`    | Chainlink Functions subscription                           | Optional                                       |
| `CHAINLINK_FUNCTIONS_CALLBACK_GAS_LIMIT` | Callback gas limit                                         | Optional                                       |
| `CHAINLINK_FUNCTIONS_DON_ID`             | Chainlink DON ID                                           | Optional                                       |
| `CHAINLINK_ORACLE_API_BASE_URL`          | Public base URL for `/api/oracle/functions/[policyId]`     | Optional unless using Chainlink Functions mode |

### `packages/ponder`

| Variable                  | Purpose                              | Status                        |
| ------------------------- | ------------------------------------ | ----------------------------- |
| `PONDER_RPC_URL_11155111` | Sepolia RPC for indexing             | Required only if using Ponder |
| `DATABASE_URL`            | Postgres connection                  | Required only if using Ponder |
| `DATABASE_SCHEMA`         | Separate schema for indexed gas data | Optional, recommended         |

## How to run the project

### Current checked-in MVP flow

1. Configure environment variables for Hardhat and Next.js.
2. Generate Prisma client, run migrations, and seed the sample flight data.
3. Deploy the contracts to Sepolia with `yarn deploy --network sepolia`.
4. Start the frontend:
   ```bash
   yarn start
   ```
5. Start the oracle worker in a separate terminal:
   ```bash
   yarn oracle:worker
   ```
6. Optionally start the Ponder indexer in another terminal:
   ```bash
   yarn ponder:dev
   ```

### What to expect at runtime

- The frontend serves traveler and admin pages from `http://localhost:3000`.
- The traveler can browse plans, buy a policy, and view policies if the wallet has MockUSDC and the selected flight exists in Postgres.
- The admin can update flight statuses and review oracle history when connected as `NEXT_PUBLIC_ADMIN_WALLET`.
- The worker resolves due policies and writes audit records into `OracleRequestAudit`.

## Testing

Run the contract test suite with:

```bash
yarn test
```

What the current tests cover:

- policy purchase and oracle-driven delay payout paths
- no-payout behavior for delays below threshold
- cancellation payout behavior
- simulated callback fulfillment through `ChainlinkDemoOracleConsumer`
- mock Functions-router-based request and fulfillment flow
- separation between owner-only configuration and dedicated worker execution
- gas budget checks for deposit, purchase, oracle request, and oracle fulfillment

What is not comprehensively covered:

- frontend integration tests
- API authentication tests
- broad end-to-end browser tests
- production deployment verification

## Current limitations

- The oracle flow is not a decentralized live oracle. It is a repository-controlled, worker-driven process based on Postgres flight data and internal source voting.
- Flight records are seeded and manually updated through the admin interface. No live airline data feed is present in the repository.
- The payment token is `MockUSDC`, so traveler and liquidity-provider wallets must be funded manually for demos.
- Admin gating is primarily client-side through `NEXT_PUBLIC_ADMIN_WALLET`. Critical contract permissions are on-chain, but API-level admin authorization is limited.
- The frontend is currently configured for Sepolia. Local Hardhat scripts remain in the repo, but the frontend is not set to local chain mode by default.
- Ponder analytics are optional. The application can run without Ponder, and the current metrics service reads Postgres directly when indexed gas data is available.
- The repository still contains Scaffold-ETH leftovers such as `YourContract`, `/debug`, and `/blockexplorer`.

## Future improvements

- Replace seeded and manual flight updates with a verifiable external flight data source.
- Strengthen server-side admin authentication for mutation routes.
- Add a safer demo token provisioning flow for traveler and liquidity-provider wallets.
- Expand automated test coverage across frontend, API, and full end-to-end settlement flows.
- Provide a clearer local-network profile alongside the current Sepolia-first configuration.
- Replace demo and manual oracle components with a stronger production-oriented oracle design.

## Accuracy notes

- This README describes the current repository state and checked-in configuration. It does not prove that any external service, Sepolia deployment, or Chainlink subscription is currently live.
- `ChainlinkDemoOracleConsumer` is implemented and deployed by the Hardhat scripts, but it still consumes this application's own oracle API. It should not be described as a fully decentralized production oracle integration.
- The current admin oracle page is an audit and history view. The automated oracle execution happens through `yarn oracle:worker`, not through manual transaction buttons in the page itself.
- The frontend is configured for Sepolia in `packages/nextjs/scaffold.config.ts`. Local chain scripts exist, but running purely local requires additional configuration changes.
- `NEXT_PUBLIC_PONDER_URL` is present in the env example, but the core application does not require the Ponder GraphQL endpoint to function.
