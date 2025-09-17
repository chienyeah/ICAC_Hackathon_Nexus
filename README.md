# SportChain Integrity – Local Prototype

> End‑to‑end prototype: smart contracts (Hardhat), indexer + API (Node/Express + Prisma/SQLite), and a React web app with MetaMask.

## Requirements

- Node.js 20 LTS (recommended) and npm 10+
- Git
- MetaMask browser extension
- Windows 10/11, macOS, or Linux

## Quick start (one command)

This repo can boot the full stack with a single command. It will start a local Hardhat chain, deploy contracts, generate env files, run Prisma against SQLite, seed demo data, and start the indexer, API and web.

```bash
npm run up
```

Services started:
- Hardhat node: http://127.0.0.1:8545
- API: http://localhost:4000
- Web: http://localhost:5173

Then open the web URL and click “Connect MetaMask” (chain id 31337) to use the app.

## Useful scripts
- `npm run chain` – start only the Hardhat node
- `npm run deploy` – deploy contracts to localhost
- `npm run indexer` – start the indexer only
- `npm run api` – start the API only
- `npm run web` – start the web app only
- `npm run clean` – clean Hardhat artifacts and dev DB

## Troubleshooting
- Port 8545 in use → stop other chains or change ports
- Prisma schema changed → `npx prisma db push --force-reset`
- Contracts changed → `npx hardhat clean && npm run up`
- Web styles stale → stop the dev server and run `npm run up` again

## Tech stack
- Solidity 0.8.x + OpenZeppelin (AccessControl, Pausable, ERC20)
- Hardhat + TypeChain + ethers v6
- Node.js/Express + Prisma/SQLite
- React + Vite + wagmi/viem + MetaMask
