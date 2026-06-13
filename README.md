# TicketShield - Blockchain-based Event Ticketing System

A decentralized event ticketing platform built with React, Solidity smart contracts, and MongoDB.

## Project Structure

```
ticketshield/
├── frontend/          # React + Vite + TypeScript + Tailwind
│   ├── src/           # React components, pages, hooks, integrations
│   ├── public/        # Static assets
│   ├── index.html     # Entry HTML
│   ├── package.json   # Frontend dependencies
│   └── vite.config.ts # Vite configuration
│
├── backend/           # Smart contracts + MongoDB API
│   ├── contracts/     # Solidity smart contracts
│   ├── scripts/       # Deployment & test scripts
│   ├── deployments/   # Deployment records
│   ├── hardhat.config.cjs
│   └── package.json   # Backend dependencies
│
├── package.json       # Root orchestrator
└── README.md
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation

```bash
# Install all dependencies (frontend + backend)
npm run install:all
```

### Development

```bash
# Start the frontend dev server
npm run dev

# Compile smart contracts
npm run compile

# Deploy smart contracts
npm run deploy
```

### Frontend Commands

```bash
cd frontend
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # Run ESLint
npm run test      # Run tests
```

### Backend Commands

```bash
cd backend
npm run compile            # Compile contracts
npm run deploy             # Deploy contracts
npm run deploy:ganache     # Deploy to Ganache
npm run deploy:sepolia     # Deploy to Sepolia
npm run test               # Run contract tests
npm run update-abi         # Update ABI in frontend
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion
- **Blockchain**: Solidity, Hardhat, ethers.js
- **Database**: MongoDB
- **State Management**: TanStack React Query
