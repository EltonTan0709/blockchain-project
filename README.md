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
- Seed data in `packages/nextjs/prisma/seed.ts` loads sample flights such as `SQ318`, `BA12`, `UA1`, `EK405`, `NH802`, `QF72`, `LH779`, and `CX715`.
- Those seeded departure timestamps are fixed calendar dates, not "today plus a few hours". A flight that is buyable now can become unbuyable later once its departure time is in the past.
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

### Recommended starting path

For most teammates, the smoothest first run is:

- deploy to Sepolia
- use Postgres for seeded flights and audit history
- run the dedicated oracle worker
- keep `CHAINLINK_FUNCTIONS_ENABLED=false` and use simulated callback mode first
- leave Ponder disabled until the core flow works

Once that end-to-end flow works, enable real Chainlink Functions as a second step.

### Prerequisites

- Node.js `>=20.18.3`
- Yarn `3.2.3` or compatible Corepack-managed Yarn
- A PostgreSQL database
- MetaMask or another injected browser wallet for testing the frontend on Sepolia
- Sepolia ETH for every wallet that will sign transactions
- Optional: a dedicated oracle worker wallet
- Optional: a Chainlink Functions subscription funded with LINK if you plan to enable real Functions mode

If `yarn` is not recognized on your machine, run this once first:

```bash
corepack enable
```

### Before you type anything

Do these small preparation steps first:

1. Open PowerShell in the repository root.
2. Make sure you are inside the folder that contains this `README.md`.
3. Plan to keep at least three terminal windows open:
   - Terminal A for one-time setup commands
   - Terminal B for `yarn start`
   - Terminal C for `yarn oracle:worker`
4. Keep MetaMask open in the browser.
5. Do not jump ahead. If one step fails, fix that step before going to the next one.
6. If you are unsure which wallet is active in MetaMask, stop and check before signing anything.

You can quickly verify you are in the right folder with:

```powershell
Get-Location
Get-ChildItem README.md
```

### Install dependencies

```bash
yarn install
```

Wait until the command finishes fully.

If this step succeeds, you should stay in the repo root and see no install errors.

### Create local environment files

Create the local env files from these examples:

- `packages/hardhat/.env` from `packages/hardhat/.env.example`
- `packages/nextjs/.env.local` from `packages/nextjs/.env.example`
- `packages/ponder/.env` from `packages/ponder/.env.example` if you want optional analytics

`packages/nextjs/.env.local` is the safest default for local work because both the Next.js app and the oracle worker script load it.

If you want exact PowerShell commands, run:

```powershell
Copy-Item packages\hardhat\.env.example packages\hardhat\.env
Copy-Item packages\nextjs\.env.example packages\nextjs\.env.local
```

You can skip `packages/ponder/.env` for now because Ponder is optional. Create it only if you plan to run `yarn ponder:dev`.

If PowerShell says a file already exists, stop and open that file instead of overwriting it blindly.

### Open the env files and edit them carefully

After copying the files:

1. Open `packages/hardhat/.env`.
2. Open `packages/nextjs/.env.local`.
3. Replace the placeholder values with your real values.
4. Save both files before running any setup commands.

Important:

- do not leave placeholder text like `0xYOUR_WORKER_WALLET_ADDRESS`
- do not leave angle brackets like `<your subscription number>`
- do not put quotes around values unless you truly need them
- do not add extra spaces before or after the `=`

Bad:

```dotenv
NEXT_PUBLIC_ADMIN_WALLET="0x123..."
ORACLE_AUTOMATION_ADDRESS= 0x456...
CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID=<your subscription number>
```

Good:

```dotenv
NEXT_PUBLIC_ADMIN_WALLET=0x123...
ORACLE_AUTOMATION_ADDRESS=0x456...
CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID=123
```

### How to get a `DATABASE_URL`

This is one of the most common setup blockers.

You need any PostgreSQL database. It can be:

- a local PostgreSQL database on your computer
- a hosted PostgreSQL database from a cloud provider

What you need from that database is one connection string. It usually looks like one of these:

```dotenv
DATABASE_URL=postgres://USERNAME:PASSWORD@HOST:5432/DATABASE
```

or

```dotenv
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE
```

Use this checklist:

1. Create a PostgreSQL database somewhere.
2. Copy its connection string.
3. Paste it into `packages/nextjs/.env.local` as `DATABASE_URL=...`.
4. Save the file.

If your provider gives you both a direct database URL and a pooled database URL:

- either can work
- for pooled URLs, keeping `PRISMA_CONNECTION_LIMIT=1` is a good default

If you are not sure whether your `DATABASE_URL` is valid, the easiest test is to continue to the Prisma step. If `prisma:migrate:dev` connects successfully, your database URL is good enough.

### PostgreSQL setup in simple steps

If you already have a working PostgreSQL database, you can skip this section and just paste its connection string into `DATABASE_URL`.

If you do not have one yet, choose one path below.

#### Option A: use PostgreSQL on your own computer

This is the easiest way to understand what is happening.

1. Install PostgreSQL on your computer.
2. During installation, remember:
   - the username you created
   - the password you created
   - the port, which is usually `5432`
3. After installation, create a database for this project.
4. Use a simple name like `flightsure`.

If `psql` is available on your machine, you can create the database with:

```powershell
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE flightsure;"
```

Replace `postgres` with your actual PostgreSQL username if it is different.

If the database already exists, that is fine. You do not need to create it again.

If `psql` is not available, use one of these instead:

1. Open `SQL Shell (psql)` if PostgreSQL installed it.
2. Or open `pgAdmin` if PostgreSQL installed it.
3. Create a database named `flightsure`.
4. Then continue with the `DATABASE_URL` step below.

Then put this into `packages/nextjs/.env.local`:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/flightsure
```

Replace:

- `postgres` with your PostgreSQL username
- `YOUR_PASSWORD` with your PostgreSQL password
- `5432` with your real port if you changed it
- `flightsure` with your real database name if you used a different one

#### Option B: use a hosted PostgreSQL database

If you do not want to install PostgreSQL locally, you can use a hosted PostgreSQL provider.

Use this path:

1. Create a PostgreSQL database with your provider.
2. Copy the connection string from the provider dashboard.
3. Paste it into `packages/nextjs/.env.local` as `DATABASE_URL=...`.
4. Save the file.

If the provider gives you many different URLs, choose the normal PostgreSQL connection string first. If you later decide to use a pooled URL, leaving `PRISMA_CONNECTION_LIMIT=1` is a safe default.

#### How to tell whether your database step is done correctly

Before moving on, all of these should be true:

- `DATABASE_URL` is pasted into `packages/nextjs/.env.local`
- the username, password, host, port, and database name are real values
- there are no quotes around the whole URL unless your provider specifically requires them
- there is no placeholder text left inside the URL

Good example:

```dotenv
DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5432/flightsure
```

Bad examples:

```dotenv
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE
DATABASE_URL="postgresql://postgres:password@localhost:5432/flightsure"
DATABASE_URL=
```

### Wallets and accounts you need

Use separate wallets for separate responsibilities during demos. That makes the oracle flow much easier to reason about.

| Role                 | Used for                                              | What it needs                                                                                     |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Deployer / owner     | `yarn deploy`, owner-only contract configuration      | Sepolia ETH and an encrypted private key stored in `packages/hardhat/.env`                        |
| Admin UI wallet      | `/admin` and `/pool` pages                            | Its address must match `NEXT_PUBLIC_ADMIN_WALLET`; for demos this is often the same as deployer  |
| Traveler wallet      | `/insurance-plans`, `/buy-policy`, `/my-policies`     | Sepolia ETH for gas and MockUSDC for premium payments                                             |
| Oracle worker wallet | `yarn oracle:worker` and post-deploy worker config    | Sepolia ETH, `ORACLE_AUTOMATION_ADDRESS`, and matching `ORACLE_AUTOMATION_PRIVATE_KEY` in Next.js |

### MetaMask setup in very simple steps

If you are brand new to this, think of Sepolia as "practice Ethereum". The coins are fake test coins, so you can learn without spending real money.

1. Install MetaMask in your browser.
2. Open MetaMask and create a wallet if you do not already have one.
3. Save your recovery phrase somewhere safe and offline. Never paste it into this repository, any `.env` file, or chat.
4. In MetaMask settings, turn on "show test networks".
5. Switch the wallet network to `Sepolia`.
6. If Sepolia does not appear automatically, add it manually with:
   - Network name: `Sepolia`
   - RPC URL:
     - if you already have an Alchemy key, use `https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY`
     - if you do not have one yet, the easier path is to use MetaMask's built-in Sepolia network instead of manual entry
   - Chain ID: `11155111`
   - Currency symbol: `ETH`
   - Block explorer URL: `https://sepolia.etherscan.io`
7. Make the wallets you want to use for this project.

For the cleanest demo, use these separate wallets:

- one wallet for the deployer and admin
- one wallet for the oracle worker
- one wallet for the traveler

You can reuse one wallet for everything, but separate wallets make debugging much easier.

### Give each wallet a job

Use this simple rule:

- `deployer/admin wallet`: owns the contracts and sees the admin pages
- `worker wallet`: runs the oracle worker in the terminal
- `traveler wallet`: buys policies in the frontend

The admin wallet address must be copied into `NEXT_PUBLIC_ADMIN_WALLET`.

### How to tell an address and a private key apart

This matters because beginners often paste the wrong thing into `.env` files.

- a wallet address is public and looks like `0xabc123...`
- a private key is secret and also starts with `0x`, but it is much longer
- `NEXT_PUBLIC_ADMIN_WALLET` needs an address
- `ORACLE_AUTOMATION_ADDRESS` needs an address
- `ORACLE_AUTOMATION_PRIVATE_KEY` needs a private key
- `DEPLOYER_PRIVATE_KEY_ENCRYPTED` is not the raw private key; it is the encrypted value created by the repo script

Simple rule:

- if people are allowed to see it, it is probably an address
- if nobody should ever see it, it is probably a private key or recovery phrase

Never paste a MetaMask recovery phrase into this repository.

### Give the wallets Sepolia ETH

Every wallet that sends transactions needs Sepolia ETH for gas.

Important:

- if your deployer wallet will come from `yarn account:generate`, create that deployer wallet first so you know its address
- if your deployer wallet will come from `yarn account:import`, import it first so you know its address
- after you know the real wallet addresses, come back and fund them

1. Open the Chainlink faucet at `faucets.chain.link/sepolia`.
2. Connect the wallet you want to fund.
3. Ask for Sepolia ETH.
4. Repeat for the deployer/admin wallet, the worker wallet, and the traveler wallet.
5. When I checked the faucet on April 2, 2026, it showed `0.5 ETH` per Sepolia ETH drip. Faucet amounts can change later.

### Create or import the deployer account

If you want the deployer wallet to live inside the repository config, use one of these scripts:

```bash
yarn account:generate
```

Or import an existing private key:

```bash
yarn account:import
```

Those commands store an encrypted `DEPLOYER_PRIVATE_KEY_ENCRYPTED` value in `packages/hardhat/.env`.

If you run `yarn account:generate`, the repository creates a brand new wallet for you and asks you to choose a password. That password is used to encrypt the deployer private key before saving it in `packages/hardhat/.env`.

If you run `yarn account:import`, the repository asks for an existing private key and then encrypts it before saving it.

If you plan to use the deployer wallet as the admin wallet too:

1. run `yarn account:generate` or `yarn account:import`
2. note the wallet address printed by the script
3. set `NEXT_PUBLIC_ADMIN_WALLET` to that same address
4. import that same wallet into MetaMask if you want to use it in the browser

If you want the same deployer wallet in MetaMask as well, reveal it and import that private key into MetaMask:

```bash
yarn account:reveal-pk
```

Use `yarn account:reveal-pk` only for local/test workflows. Do not do this with a production wallet.

### Prepare the oracle worker wallet

The oracle worker is easiest to run when it has its own dedicated Sepolia wallet. This worker wallet is just a normal Sepolia wallet that your terminal script will use.

1. Create or import a separate worker wallet in MetaMask.
2. Fund it with Sepolia ETH.
3. Put the worker address into `ORACLE_AUTOMATION_ADDRESS` in `packages/hardhat/.env`.
4. Put the matching raw `0x`-prefixed private key into `ORACLE_AUTOMATION_PRIVATE_KEY` in `packages/nextjs/.env.local`.
5. Make sure the address in step 3 and the private key in step 4 belong to the same wallet.

### How to copy values from MetaMask into the env files

Use this tiny checklist while filling `.env`:

1. In MetaMask, click the active account.
2. Copy the wallet address when the field wants an address.
3. Export the private key only for the worker wallet if the field wants a private key.
4. Paste carefully into the correct variable.

Use this mapping:

- copy the admin wallet address into `NEXT_PUBLIC_ADMIN_WALLET`
- copy the worker wallet address into `ORACLE_AUTOMATION_ADDRESS`
- copy the worker wallet private key into `ORACLE_AUTOMATION_PRIVATE_KEY`

If the worker address and worker private key do not belong to the same wallet, the oracle worker will fail.

### Fill in the env files before doing anything else

Use this as the easiest first-run setup.

`packages/hardhat/.env`

```dotenv
ALCHEMY_API_KEY=
ETHERSCAN_V2_API_KEY=
ORACLE_DEMO_MODE=true
ORACLE_DEMO_DELAY_SECONDS=30
ORACLE_AUTOMATION_ADDRESS=0xYOUR_WORKER_WALLET_ADDRESS
CHAINLINK_FUNCTIONS_ROUTER=
CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID=
CHAINLINK_FUNCTIONS_CALLBACK_GAS_LIMIT=300000
CHAINLINK_FUNCTIONS_DON_ID=
CHAINLINK_ORACLE_API_BASE_URL=
DEPLOYER_PRIVATE_KEY_ENCRYPTED=PASTE_THE_ENCRYPTED_VALUE_CREATED_BY_YARN_ACCOUNT_GENERATE_OR_IMPORT
```

`packages/nextjs/.env.local`

```dotenv
DATABASE_URL=postgres://USERNAME:PASSWORD@HOST:5432/DATABASE
PRISMA_CONNECTION_LIMIT=1
PONDER_DATABASE_SCHEMA=ponder
NEXT_PUBLIC_ADMIN_WALLET=0xYOUR_ADMIN_WALLET_ADDRESS
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_PONDER_URL=http://localhost:42069
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=
ORACLE_AUTOMATION_PRIVATE_KEY=0xYOUR_WORKER_PRIVATE_KEY
ORACLE_WORKER_POLL_INTERVAL_MS=15000
CHAINLINK_FUNCTIONS_ENABLED=false
```

These blocks are examples. Replace every value on the right side of `=` with your own real value or leave it blank only when the instructions explicitly tell you to leave it blank.

For your first working setup:

- keep `ORACLE_DEMO_MODE=true`
- keep `ORACLE_DEMO_DELAY_SECONDS=30`
- leave all Chainlink Functions values blank
- keep `CHAINLINK_FUNCTIONS_ENABLED=false`
- focus on getting the simulated worker flow running first

### What each important env value means in plain English

`packages/hardhat/.env`

- `DEPLOYER_PRIVATE_KEY_ENCRYPTED`
  - this is the deployer wallet used by `yarn deploy --network sepolia`
- `ORACLE_DEMO_MODE`
  - set this to `true` for your first Sepolia test
  - this makes a new policy become oracle-ready shortly after purchase instead of waiting until the real departure time
- `ORACLE_DEMO_DELAY_SECONDS`
  - `30` means the worker can start evaluating about 30 seconds after the policy is bought
- `ORACLE_AUTOMATION_ADDRESS`
  - this is the worker wallet address that the contracts will trust
- `CHAINLINK_FUNCTIONS_ROUTER`
  - leave this blank for the simple path
  - fill it only before deploying for real Chainlink Functions mode

`packages/nextjs/.env.local`

- `DATABASE_URL`
  - this tells Prisma where your PostgreSQL database is
- `NEXT_PUBLIC_ADMIN_WALLET`
  - this decides which wallet sees the admin routes in the frontend
- `ORACLE_AUTOMATION_PRIVATE_KEY`
  - this lets the terminal worker script sign blockchain transactions
- `CHAINLINK_FUNCTIONS_ENABLED`
  - `false` means simulated callback mode
  - `true` means live Chainlink Functions mode

### Quick self-check before you continue

Before you move on, all of these should be true:

- you created `packages/hardhat/.env`
- you created `packages/nextjs/.env.local`
- `DEPLOYER_PRIVATE_KEY_ENCRYPTED` is not blank
- `ORACLE_DEMO_MODE=true`
- `ORACLE_AUTOMATION_ADDRESS` is not blank
- `DATABASE_URL` is not blank
- `NEXT_PUBLIC_ADMIN_WALLET` is not blank
- `ORACLE_AUTOMATION_PRIVATE_KEY` is not blank
- `CHAINLINK_FUNCTIONS_ENABLED=false`
- you saved both env files after editing them

### Prepare the database

```bash
yarn workspace @se-2/nextjs prisma:generate
yarn workspace @se-2/nextjs prisma:migrate:dev
yarn workspace @se-2/nextjs prisma:seed
```

Run those commands one at a time, in that exact order.

What success looks like:

- `prisma:generate` finishes without errors
- `prisma:migrate:dev` says the migration was applied or is already up to date
- `prisma:seed` completes and inserts the sample flights

If `prisma:migrate:dev` fails, stop there and fix `DATABASE_URL` before moving on.

If you want the safest beginner workflow, run them like this:

1. Run:

```bash
yarn workspace @se-2/nextjs prisma:generate
```

Wait for it to finish.

2. Run:

```bash
yarn workspace @se-2/nextjs prisma:migrate:dev
```

Wait for it to finish.

3. Run:

```bash
yarn workspace @se-2/nextjs prisma:seed
```

Wait for it to finish.

Only continue to the Sepolia deployment after all three commands work.

### Step-by-step Sepolia deployment without real Chainlink Functions

Do this path first. It is the easiest path and it proves the app works before you add more moving parts.

#### What this "simple path" does

- contracts are deployed to Sepolia
- the oracle worker still runs
- the worker sends simulated callback transactions itself
- the first policy can become oracle-ready about 30 seconds after purchase because `ORACLE_DEMO_MODE=true`
- you do not need a Chainlink subscription yet
- you do not need test LINK yet

#### Step 1: make sure the env files are ready

Before deploying:

- `packages/hardhat/.env` must contain `DEPLOYER_PRIVATE_KEY_ENCRYPTED`
- `packages/hardhat/.env` must contain `ORACLE_DEMO_MODE=true`
- `packages/hardhat/.env` should usually keep `ORACLE_DEMO_DELAY_SECONDS=30` for the first test
- `packages/hardhat/.env` must contain `ORACLE_AUTOMATION_ADDRESS`
- `packages/nextjs/.env.local` must contain `DATABASE_URL`
- `packages/nextjs/.env.local` must contain `NEXT_PUBLIC_ADMIN_WALLET`
- `packages/nextjs/.env.local` must contain `ORACLE_AUTOMATION_PRIVATE_KEY`
- `packages/nextjs/.env.local` must contain `CHAINLINK_FUNCTIONS_ENABLED=false`

#### Step 2: prepare the database

Run these commands one by one:

```bash
yarn workspace @se-2/nextjs prisma:generate
yarn workspace @se-2/nextjs prisma:migrate:dev
yarn workspace @se-2/nextjs prisma:seed
```

That does three things:

- makes the Prisma client
- creates the database tables
- puts sample flights into the database

#### Step 3: deploy the contracts to Sepolia

Run:

```bash
yarn deploy --network sepolia
```

What this does:

- deploys `MockUSDC`
- deploys `InsurancePool`
- deploys `OracleCoordinator`
- deploys `PolicyManager`
- deploys `ChainlinkDemoOracleConsumer`
- writes deployment files to `packages/hardhat/deployments/sepolia`
- updates frontend contract data in `packages/nextjs/contracts/deployedContracts.ts`

Do not close the terminal until the command fully finishes.

Important:

- this command asks for the deployer password in the terminal
- type the same password you chose during `yarn account:generate` or `yarn account:import`
- while typing, the password characters may not show on screen
- press `Enter` after typing the password
- if the password is wrong, the deploy will fail and you need to run it again

When this step succeeds, you should have fresh deployment files inside `packages/hardhat/deployments/sepolia`.

Also expect the command to take longer than a normal local script because it is sending real Sepolia transactions.

#### Step 4: point the contracts at the worker wallet

Run:

```bash
yarn configure:oracle-worker
```

What this does:

- sets `OracleCoordinator.automationForwarder` to the worker wallet
- sets the consumer contract's `functionsRouter` callback-authorized wallet to the worker wallet in simulated mode
- removes direct reporter permission from the deployer wallet

In simple words: this tells the contracts, "the worker wallet is the special wallet allowed to perform oracle work".

Important detail:

- this `functionsRouter` wallet is the worker wallet used by the simulated callback flow in this repository
- it is not the same thing as the immutable live Chainlink router that comes from `CHAINLINK_FUNCTIONS_ROUTER` during deployment

Important:

- this command also asks for the deployer password
- use the same deployer password as the deploy step
- if the terminal looks stuck, check whether it is waiting for your password

When this step works, the script should print messages telling you the worker address was configured or was already set correctly.

#### Step 5: start the frontend

Run:

```bash
yarn start
```

Then open `http://localhost:3000`.

If the page does not open, check Terminal B for errors before doing anything else.

#### Step 6: start the worker in another terminal

Run:

```bash
yarn oracle:worker
```

Keep this terminal open. The worker keeps checking for policies that are ready to be evaluated.

If the worker crashes immediately, the most common causes are:

- `ORACLE_AUTOMATION_PRIVATE_KEY` is missing
- the worker private key is not a real `0x` private key
- the worker wallet has no Sepolia ETH
- the database connection string is wrong

If the worker does not crash, you should see log lines that start with `[oracle-worker]`.

#### Step 7: give the traveler wallet some MockUSDC

The traveler cannot buy a policy with only Sepolia ETH. The traveler also needs `MockUSDC`.

Use the admin/deployer wallet because only the owner can mint `MockUSDC`.

1. Open the app in the browser.
2. Connect the admin/deployer wallet.
3. Go to `/debug`.
4. Find the `MockUSDC` contract.
5. Call the `mint` function.
6. For `to`, paste the traveler wallet address.
7. For `amount`, type a whole number like `1000`.
8. Confirm the transaction in MetaMask.
9. Wait for MetaMask to show the transaction as confirmed.

Because `MockUSDC` uses 6 decimals internally, typing `1000` here means `1000 MockUSDC`, not `0.000001`.

Wait for the mint transaction to complete before switching wallets.

#### Step 8: buy a policy as the traveler

1. In MetaMask, switch to the traveler wallet.
2. Make sure MetaMask is on Sepolia.
3. Open `http://localhost:3000/insurance-plans`.
4. Pick a plan.
5. Go to `http://localhost:3000/buy-policy`.
6. For the first real Sepolia test, type flight number `CX715`.
7. Approve MockUSDC when the app asks.
8. Wait for the approval transaction to finish.
9. Buy the policy.
10. Wait for the purchase transaction to finish.

Do not close MetaMask or refresh mid-transaction.

Why `CX715`:

- `PolicyManager.buyPolicy` rejects flights whose departure is already in the past
- in the checked-in seed data verified on April 2, 2026, `CX715` is the future sample flight
- most of the other seeded flights already have past departures, so the app may auto-fill a time that the contract will reject

If you are reading this after `2027-04-02T10:20:00Z`, `CX715` will also be in the past. In that case, move at least one seeded flight to a future date in `packages/nextjs/prisma/seed.ts`, then run `yarn workspace @se-2/nextjs prisma:seed` again before continuing.

What success looks like:

- you see an approval transaction first
- you see a purchase transaction second
- the policy appears later in `http://localhost:3000/my-policies`

#### Step 8.5: fastest guaranteed first success path

If you want the most deterministic first settlement test with the current seeded data, use this exact combination:

1. Choose the `Flight Cancellation Basic` plan.
2. Use flight number `CX715`.
3. Finish the purchase as the traveler.
4. Switch MetaMask back to the admin wallet.
5. Open `http://localhost:3000/admin/flights`.
6. Find `CX715`.
7. Change the status to `CANCELLED`.
8. Put a simple note such as `Cancelled for smoke test`.
9. Submit the update.
10. Wait about 30 to 45 seconds for the worker to process it.

Why this path is easiest:

- `buyPolicy` requires a future departure, so a past flight like `UA1` cannot be purchased
- `CX715` is future in the checked-in seed data verified on April 2, 2026
- cancellation cover pays out when the oracle outcome is `CANCELLED`
- `ORACLE_DEMO_MODE=true` lets the worker evaluate soon after purchase instead of waiting until the real departure time

So this is usually the fastest way to prove the full buy-to-settlement flow works.

#### Step 9: change the flight status as the admin

1. Switch MetaMask back to the admin wallet.
2. Open `http://localhost:3000/admin/flights`.
3. Find the flight you used.
4. If you followed the fastest path above, set the status to `CANCELLED`.
5. If you did not follow the fastest path, choose the status that matches the outcome you want to test.
6. Submit the update in the page.

Important:

- this flight-status update is a normal app API request
- you usually will not get a MetaMask popup for this step
- the admin wallet still matters because the page sends your wallet address to the admin API

After this, give the worker about 15 to 30 seconds to notice the updated policy and flight state. The default poll interval is 15 seconds.

If `ORACLE_DEMO_MODE=true` and `ORACLE_DEMO_DELAY_SECONDS=30`, the usual wait is:

- about 30 seconds for the policy to become oracle-ready
- up to another 15 seconds for the worker poll loop to notice it

If `ORACLE_DEMO_MODE=false`, the worker waits until the policy's actual departure timestamp instead.

#### Step 10: watch the worker settle the policy

If the policy is due and the flight data says there should be a payout or no payout, the worker will process it.

Look in:

- the worker terminal logs
- `http://localhost:3000/my-policies`
- `http://localhost:3000/admin/oracle`

If all of that works, your Sepolia setup is working even without live Chainlink Functions.

### Very first success checklist

You know the simple setup worked if all of these happen:

- the frontend opens on `http://localhost:3000`
- the traveler can connect a wallet
- the traveler can approve MockUSDC
- the traveler can buy a policy
- the admin can update a flight
- the worker terminal shows oracle activity
- the policy status changes in `My Policies`

### Step-by-step real Chainlink Functions setup on Sepolia

Do this only after the simple path above already works.

#### What these Chainlink words mean in plain English

- `subscription`: your prepaid Chainlink balance box
- `consumer`: the smart contract allowed to spend from that balance box
- `router`: the official Chainlink contract on Sepolia that receives Functions requests
- `DON ID`: the name of the Chainlink node group that handles the request

#### Sepolia values for this project

Use these exact values for Sepolia:

- `CHAINLINK_FUNCTIONS_ROUTER=0xb83E47C2bC239B3bf370bc41e1459A34b41238D0`
- `CHAINLINK_FUNCTIONS_DON_ID=fun-ethereum-sepolia-1`
- encoded DON ID if you ever need the raw `bytes32` value:
  `0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000`
- Sepolia LINK token address:
  `0x779877A7B0D9E8603169DdbD7836e478b4624789`

These were verified on April 2, 2026.

#### Very important warning before you deploy

If you want real Chainlink Functions, fill in `CHAINLINK_FUNCTIONS_ROUTER` before running `yarn deploy --network sepolia`.

Why this matters:

- this repository passes `CHAINLINK_FUNCTIONS_ROUTER` into the consumer contract constructor during deployment
- the `yarn configure:chainlink-functions` script can update subscription settings later
- but it cannot change the constructor router that was baked into the deployed contract

So if you forget the router and deploy first, the clean fix is to redeploy.

#### Step 1: put the real Sepolia router into `packages/hardhat/.env`

Set:

```dotenv
CHAINLINK_FUNCTIONS_ROUTER=0xb83E47C2bC239B3bf370bc41e1459A34b41238D0
```

Do not leave this blank if you want live Functions mode on this deployment.

#### Step 2: create a Chainlink subscription

1. Open your browser and go to `functions.chain.link/sepolia`.
2. Connect the wallet that should own the subscription.
3. The easiest choice is the same wallet you used as the deployer/admin wallet.
4. Look for the button or action that creates a new subscription.
5. Create the subscription.
6. Wait until the page shows the new subscription details.
7. Copy the subscription ID.

The subscription ID is just a normal number. Save that number into:

```dotenv
CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID=123
```

Do not convert it to hex.

#### Step 3: get test LINK and test ETH

Now your wallets need test funds.

1. Go to `faucets.chain.link/sepolia`.
2. Connect the subscription-owner wallet.
3. Request test LINK.
4. Request Sepolia ETH too if that wallet is also your deployer/admin wallet.
5. Repeat ETH funding for the worker wallet and traveler wallet if needed.
6. Wait until the tokens appear in the wallet before moving on.

When I checked the faucet on April 2, 2026, it showed:

- `25 LINK` per Sepolia LINK drip
- `0.5 ETH` per Sepolia ETH drip

Those amounts can change later.

#### Step 4: fund the subscription with LINK

Getting LINK into the wallet is not the same as getting LINK into the subscription.

You must move LINK into the subscription balance:

1. Go back to `functions.chain.link/sepolia`.
2. Open the subscription you just created.
3. Use the funding option in the page.
4. Deposit some LINK into the subscription.
5. Wait until the subscription page shows the new LINK balance.

For testing, do not leave it almost empty. The Chainlink Sepolia page currently lists:

- a 10-request threshold
- a 2 LINK cancellation fee

So give yourself breathing room.

#### Step 5: set the rest of the Chainlink env values

In `packages/hardhat/.env`, set:

```dotenv
CHAINLINK_FUNCTIONS_ROUTER=0xb83E47C2bC239B3bf370bc41e1459A34b41238D0
CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID=123
CHAINLINK_FUNCTIONS_CALLBACK_GAS_LIMIT=300000
CHAINLINK_FUNCTIONS_DON_ID=fun-ethereum-sepolia-1
CHAINLINK_ORACLE_API_BASE_URL=https://your-app-name.vercel.app
```

In `packages/nextjs/.env.local`, set:

```dotenv
CHAINLINK_FUNCTIONS_ENABLED=true
```

After saving the files, double-check:

- the router value is not blank
- the subscription ID is a normal number
- the DON ID says `fun-ethereum-sepolia-1`
- the API base URL starts with `https://`
- the API base URL does not end with `/`

#### Step 6: understand what `CHAINLINK_ORACLE_API_BASE_URL` must be

This must be the public base URL of your Next.js app.

Examples:

- good: `https://my-app.vercel.app`
- bad: `http://localhost:3000`
- bad: `https://my-app.vercel.app/`

Why:

- Chainlink's network must be able to reach your app from the public internet
- `localhost` only exists on your own computer
- the code builds the final request URL by adding `/api/oracle/functions/<policyId>` after the base URL
- if you add a trailing slash, the final URL becomes messy

#### Step 6.5: get a public frontend URL if you do not already have one

Live Chainlink Functions cannot call your laptop's `localhost`.

If you want a simple public deployment using the built-in Vercel helper in this repository:

1. In Terminal A, run:

```bash
yarn vercel:login
```

2. Finish the Vercel login in the browser.
3. Then run:

```bash
yarn vercel:yolo --prod
```

4. Wait for Vercel to print a public `https://...` URL.
5. Put that URL into `CHAINLINK_ORACLE_API_BASE_URL`.

Example:

```dotenv
CHAINLINK_ORACLE_API_BASE_URL=https://your-app-name.vercel.app
```

Do not use:

- `http://localhost:3000`
- a private LAN IP
- a URL that ends with `/`

#### Step 6.6: make sure the public deployment has the right env vars too

This part is easy to miss.

Your local `.env.local` does not automatically become the server env for the public Vercel deployment.

For the public oracle API route to work, the deployed app needs at least:

- `DATABASE_URL`
- `PRISMA_CONNECTION_LIMIT=1`

If you want the public deployed frontend to behave the same way as local, also add:

- `NEXT_PUBLIC_ADMIN_WALLET`
- `NEXT_PUBLIC_ALCHEMY_API_KEY` if you are using your own key
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` if you are using your own project id

Simple rule:

- if the public app cannot connect to the database, Chainlink cannot read oracle decisions from it
- if you add or change env vars in Vercel, redeploy afterward

Use this exact Vercel checklist:

1. Open the Vercel dashboard in your browser.
2. Open the project for this app.
3. Open `Settings`.
4. Open `Environment Variables`.
5. Add `DATABASE_URL`.
6. Add `PRISMA_CONNECTION_LIMIT` with value `1`.
7. If needed, also add `NEXT_PUBLIC_ADMIN_WALLET`.
8. Save the environment variables.
9. Redeploy after saving them.

If you deployed before adding those env vars, run another production deploy:

```bash
yarn vercel:yolo --prod
```

#### Step 7: deploy the contracts to Sepolia again

Now deploy with the real router value in place:

```bash
yarn deploy --network sepolia
```

#### Step 8: find the deployed consumer address

After deployment, find the `ChainlinkDemoOracleConsumer` address.

You can find it in:

- `packages/hardhat/deployments/sepolia/ChainlinkDemoOracleConsumer.json`
- `packages/nextjs/contracts/deployedContracts.ts`

This address is the consumer you must add to the subscription.

#### Step 9: add the consumer contract to the subscription

1. Go back to `functions.chain.link/sepolia`.
2. Open your subscription.
3. Find the add-consumer action.
4. Paste the deployed `ChainlinkDemoOracleConsumer` address.
5. Confirm it.
6. Wait until the subscription page shows the consumer in the list.

If you skip this step, the subscription will not allow this project to spend from it.

#### Step 10: configure the on-chain Chainlink settings

Run:

```bash
yarn configure:chainlink-functions
```

This script writes these values into the deployed `ChainlinkDemoOracleConsumer`:

- subscription ID
- callback gas limit
- DON ID
- oracle API base URL

It does not:

- create the subscription
- fund the subscription
- add the consumer
- change a wrong constructor router

Important:

- this command also asks for the deployer password in the terminal
- use the same password you used for `yarn deploy --network sepolia`

If this script fails, check the four most common causes:

- the router was blank when you deployed
- the subscription ID is wrong
- the DON ID is wrong
- the API base URL is not public HTTPS
- the public deployed app does not have a working `DATABASE_URL`

#### Step 11: configure the worker wallet again

Run:

```bash
yarn configure:oracle-worker
```

This keeps the worker permissions lined up with the wallet you configured.

This command also asks for the deployer password again.

#### Step 12: restart the app and worker

Run:

```bash
yarn start
```

In a second terminal, run:

```bash
yarn oracle:worker
```

Because `CHAINLINK_FUNCTIONS_ENABLED=true`, the worker now sends live Chainlink Functions requests instead of simulated callback transactions.

#### Step 13: test the full live Functions flow

1. Mint MockUSDC to the traveler wallet if needed.
2. Buy a policy as the traveler.
3. Make note of the policy ID if the UI shows it.
4. Update the flight status as the admin.
5. Wait for the worker to detect the due policy.
6. Watch the worker logs.
7. Check `/admin/oracle` and `/my-policies`.

Optional extra check:

1. Open your public API URL in the browser using a real policy ID.
2. Example:
   - `https://your-app-name.vercel.app/api/oracle/functions/1`
3. You should see JSON, not a browser error page.
4. If you see a server error, check the public deployment env vars first.

If that public endpoint does not work, live Chainlink Functions will not work either.

If it is working, the flow is:

- worker requests Chainlink Functions
- Chainlink calls your public oracle API URL
- Chainlink fulfills the on-chain request
- `PolicyManager` resolves the policy
- payout happens if the policy qualifies

### Fund demo wallets with MockUSDC

Before a traveler can buy a policy or an admin can deposit liquidity, those wallets must hold MockUSDC.

- `MockUSDC.mint` is owner-only.
- The repository does not currently auto-distribute demo tokens.
- After deployment, use the owner wallet to mint MockUSDC to your traveler wallet and any liquidity-provider wallet before testing `/buy-policy` or `/pool`.
- The existing `/debug` page can help with this manual contract interaction during demos.

### Local Hardhat note

Local chain scripts still exist, but this repository is currently documented and configured as a Sepolia-first app. If you want a fully local workflow, you still need to change `packages/nextjs/scaffold.config.ts` and the related network settings before using `yarn chain` and a local deployment.

## Environment variables required

### Minimum variables for the recommended first run

For the Sepolia + simulated-oracle path, these are the minimum values you should fill in first:

`packages/hardhat/.env`

- `DEPLOYER_PRIVATE_KEY_ENCRYPTED`
- `ORACLE_DEMO_MODE=true`
- `ORACLE_DEMO_DELAY_SECONDS=30`
- `ORACLE_AUTOMATION_ADDRESS`

`packages/nextjs/.env.local`

- `DATABASE_URL`
- `NEXT_PUBLIC_ADMIN_WALLET`
- `ORACLE_AUTOMATION_PRIVATE_KEY`
- `CHAINLINK_FUNCTIONS_ENABLED=false`

Everything else can stay blank for the first pass. `NEXT_PUBLIC_ALCHEMY_API_KEY`, `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`, `ALCHEMY_API_KEY`, and `ETHERSCAN_V2_API_KEY` all have checked-in fallbacks, but you should replace them for shared, rate-limited, or long-lived environments.

### Additional variables for real Chainlink Functions mode

Fill these in only when you want the worker to submit live Chainlink Functions requests:

`packages/hardhat/.env`

- `CHAINLINK_FUNCTIONS_ROUTER`
- `CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID`
- `CHAINLINK_FUNCTIONS_CALLBACK_GAS_LIMIT`
- `CHAINLINK_FUNCTIONS_DON_ID`
- `CHAINLINK_ORACLE_API_BASE_URL`

`packages/nextjs/.env.local`

- `CHAINLINK_FUNCTIONS_ENABLED=true`

Important notes:

- `ORACLE_AUTOMATION_PRIVATE_KEY` must be the raw `0x`-prefixed private key for the same address as `ORACLE_AUTOMATION_ADDRESS`.
- `CHAINLINK_ORACLE_API_BASE_URL` must be publicly reachable over HTTPS because Chainlink Functions fetches `/api/oracle/functions/[policyId]` from that base URL.
- `CHAINLINK_FUNCTIONS_ROUTER` must be set before deployment if you want live Functions mode on that deployment.
- For Sepolia, the documented values verified on April 2, 2026 were router `0xb83E47C2bC239B3bf370bc41e1459A34b41238D0` and DON ID `fun-ethereum-sepolia-1`.
- `packages/ponder/.env` is needed only if you run the optional Ponder indexer.

### Reference: `packages/nextjs`

| Variable                                | Purpose                                                                     | Status                                  |
| --------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| `DATABASE_URL`                          | Prisma/Postgres connection                                                  | Required                                |
| `NEXT_PUBLIC_ADMIN_WALLET`              | Client-side admin UI gating                                                 | Required for admin pages                |
| `NEXT_PUBLIC_ALCHEMY_API_KEY`           | Sepolia RPC access for frontend reads                                       | Optional, falls back to checked-in default |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect and RainbowKit configuration                                  | Optional, falls back to checked-in default |
| `ORACLE_AUTOMATION_PRIVATE_KEY`         | Dedicated worker signer for oracle processing                               | Required if running the worker; raw `0x` private key |
| `ORACLE_WORKER_POLL_INTERVAL_MS`        | Oracle worker polling interval                                              | Optional                                |
| `CHAINLINK_FUNCTIONS_ENABLED`           | Switch between simulated callback mode and Chainlink Functions request mode | Optional; keep `false` until full Functions setup is complete |
| `PONDER_DATABASE_SCHEMA`                | Schema name for Ponder gas tables                                           | Optional                                |
| `NEXT_PUBLIC_PONDER_URL`                | Ponder GraphQL URL                                                          | Optional and not required for core flow |

### Reference: `packages/hardhat`

| Variable                                 | Purpose                                                    | Status                                         |
| ---------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `DEPLOYER_PRIVATE_KEY_ENCRYPTED`         | Encrypted deployer key for Hardhat scripts                 | Required for Sepolia deployment                |
| `ALCHEMY_API_KEY`                        | RPC access for remote networks such as Sepolia             | Optional, falls back to checked-in default     |
| `ETHERSCAN_V2_API_KEY`                   | Contract verification                                      | Optional, falls back to checked-in default     |
| `ORACLE_DEMO_MODE`                       | Enables demo oracle timing in `PolicyManager`              | Optional in general; set `true` for the first Sepolia smoke test |
| `ORACLE_DEMO_DELAY_SECONDS`              | Delay before a policy becomes oracle-ready in demo mode    | Optional in general; `30` is the recommended first-run value |
| `ORACLE_AUTOMATION_ADDRESS`              | Address allowed to trigger oracle upkeep and callback flow | Required if running a dedicated worker wallet  |
| `CHAINLINK_FUNCTIONS_ROUTER`             | Router used by the Functions consumer                      | Required before deployment for real Chainlink Functions mode |
| `CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID`    | Chainlink Functions subscription                           | Required only for real Chainlink Functions mode; copy the numeric ID from the Functions UI |
| `CHAINLINK_FUNCTIONS_CALLBACK_GAS_LIMIT` | Callback gas limit                                         | Required only for real Chainlink Functions mode |
| `CHAINLINK_FUNCTIONS_DON_ID`             | Chainlink DON ID                                           | Required only for real Chainlink Functions mode; `fun-ethereum-sepolia-1` for Sepolia as of April 2, 2026 |
| `CHAINLINK_ORACLE_API_BASE_URL`          | Public base URL for `/api/oracle/functions/[policyId]`     | Required only for real Chainlink Functions mode; public HTTPS, no trailing slash |

### Reference: `packages/ponder`

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
4. Run `yarn configure:oracle-worker`.
5. Start the frontend:
   ```bash
   yarn start
   ```
6. Start the oracle worker in a separate terminal:
   ```bash
   yarn oracle:worker
   ```
7. Optionally start the Ponder indexer in another terminal:
   ```bash
   yarn ponder:dev
   ```

If you want live Chainlink Functions requests instead of simulated callbacks, finish the Chainlink checklist above, set `CHAINLINK_FUNCTIONS_ENABLED=true`, then restart the worker.

### Recommended smoke test

1. Connect the traveler wallet in MetaMask on Sepolia.
2. Make sure the traveler wallet already has MockUSDC.
3. Make sure `ORACLE_DEMO_MODE=true` was already set before deployment.
4. Buy `Flight Cancellation Basic` for flight `CX715`.
5. Connect the admin wallet and update `CX715` to `CANCELLED` from the admin flights page.
6. Let the oracle worker detect the policy and submit the result.
7. Confirm the outcome in `/my-policies` and in the admin oracle history page.

### What to expect at runtime

- The frontend serves traveler and admin pages from `http://localhost:3000`.
- The traveler can browse plans, buy a policy, and view policies if the wallet has MockUSDC and the selected flight exists in Postgres.
- The admin can update flight statuses and review oracle history when connected as `NEXT_PUBLIC_ADMIN_WALLET`.
- The worker resolves due policies and writes audit records into `OracleRequestAudit`.
- If `CHAINLINK_FUNCTIONS_ENABLED=false`, the worker submits simulated callback transactions itself.
- If `CHAINLINK_FUNCTIONS_ENABLED=true`, the worker sends live Chainlink Functions requests instead.

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
