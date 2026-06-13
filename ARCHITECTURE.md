# TicketShield Architecture - MongoDB Edition

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TICKETSHIELD PLATFORM                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│   FRONTEND LAYER     │
│  http://localhost    │
│        :5173         │
│                      │
│  React + Vite        │
│  TypeScript          │
│  Tailwind CSS        │
│  React Router        │
└──────────┬───────────┘
           │
           │ HTTP Requests (Axios)
           │ /api/users
           │ /api/kyc
           │ /api/resale
           │
           ▼
┌──────────────────────────────────────────┐
│         API LAYER (Node.js/Express)      │
│      http://localhost:3001               │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │  Express Routes                     │ │
│  │  ─────────────────────────────────  │ │
│  │  GET /api/users                    │ │
│  │  POST /api/users                   │ │
│  │  GET /api/kyc                      │ │
│  │  POST /api/kyc/:id/status          │ │
│  │  GET /api/resale                   │ │
│  │  POST /api/resale                  │ │
│  │  PUT /api/resale/:id/sold          │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │  Mongoose Models                    │ │
│  │  ─────────────────────────────────  │ │
│  │  • User Schema                      │ │
│  │  • KYC Schema                       │ │
│  │  • ResaleListing Schema             │ │
│  │  • Validation                       │ │
│  │  • Indexes                          │ │
│  └─────────────────────────────────────┘ │
└──────────┬───────────────────────────────┘
           │
           │ MongoDB Connection
           │ mongodb://localhost:27017
           │
           ▼
┌──────────────────────────────────────────┐
│     DATABASE LAYER (MongoDB)             │
│                                          │
│  Database: ticketshield                  │
│  ──────────────────────────────────────  │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │  users Collection                   │ │
│  │  ─────────────────────────────────  │ │
│  │  _id, email, wallet_address         │ │
│  │  full_name, kyc_status              │ │
│  │  is_admin, is_organizer             │ │
│  │  Indexes: email, wallet_address     │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │  kyc Collection                     │ │
│  │  ─────────────────────────────────  │ │
│  │  _id, user_id, wallet_address       │ │
│  │  full_name, date_of_birth, country  │ │
│  │  id_type, status, rejection_reason  │ │
│  │  Indexes: user_id, status           │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │  resalelistings Collection          │ │
│  │  ─────────────────────────────────  │ │
│  │  _id, token_id, event_id            │ │
│  │  seller, buyer, price               │ │
│  │  status, transaction_hash, sold_at  │ │
│  │  Indexes: seller, event_id, status  │ │
│  └─────────────────────────────────────┘ │
│                                          │
└──────────────────────────────────────────┘

Optional:
┌─────────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN LAYER (Ethereum/Hardhat) - Smart Contracts          │
│  http://127.0.0.1:8545                                          │
│                                                                 │
│  • Event NFT Tickets (ERC-721)                                 │
│  • Secondary Market (Resale Logic)                             │
│  • Anti-Scalping Controls                                      │
│  • Transaction Records ↔ Stored in MongoDB                     │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Examples

### Example 1: User Registration

```
1. Frontend (React)
   ├─ User submits registration form
   ├─ Email, wallet address, name
   └─ POST /api/users (Axios)
        │
2. API Server (Express)
   ├─ Validates input
   ├─ Checks email not duplicate
   ├─ Creates User document
   └─ Mongoose saves to MongoDB
        │
3. MongoDB
   ├─ Inserts to users collection
   ├─ Auto-generates _id and timestamps
   ├─ Applies indexes (email, wallet_address)
   └─ Returns created user object
        │
4. API Response
   ├─ 201 Created status
   ├─ Returns user data
   └─ Frontend updates UI
```

### Example 2: KYC Submission & Verification

```
1. Frontend (React)
   ├─ User submits KYC form
   ├─ Personal info: name, DOB, country, ID type
   └─ POST /api/kyc (Axios)
        │
2. API Server (Express)
   ├─ Validates required fields
   ├─ Checks user_id not duplicate
   ├─ Creates KYC document
   ├─ Sets status: "pending"
   └─ Saves IP address & browser info
        │
3. MongoDB
   ├─ Inserts to kyc collection
   ├─ Sets submitted_at timestamp
   ├─ Creates indexes for efficient queries
   └─ Document ready for admin review
        │
4. Admin Panel (React)
   ├─ GET /api/kyc?status=pending
   ├─ Displays pending KYC submissions
   ├─ Admin reviews documents
   └─ PUT /api/kyc/:id/status (approve/reject)
        │
5. MongoDB Update
   ├─ Updates status: "approved"
   ├─ Sets reviewed_at timestamp
   ├─ Records admin user_id
   └─ Changed user's kyc_status in users collection
```

### Example 3: Resale Listing

```
1. Frontend (MyTickets Page)
   ├─ User clicks "Resell" button
   ├─ Enters desired price
   └─ POST /api/resale (Axios)
        │
2. API Server
   ├─ Validates token_id not already listed
   ├─ Creates ResaleListing document
   ├─ Sets status: "active"
   └─ Stores original price for reference
        │
3. MongoDB
   ├─ Inserts to resalelistings collection
   ├─ Indexes by seller, event_id, status
   └─ Ready for marketplace browsing
        │
4. Marketplace (ResaleMarket Page)
   ├─ GET /api/resale?status=active
   ├─ Displays all active listings
   ├─ User selects listing to buy
   └─ Proceeds to purchase flow
        │
5. Purchase Flow
   ├─ Frontend calls smart contract buyFromResale()
   ├─ Blockchain transaction completes
   ├─ Frontend calls PUT /api/resale/:id/sold
   ├─ Provides buyer address & tx hash
   └─ Sends API request
        │
6. MongoDB Update
   ├─ Updates status: "sold"
   ├─ Records buyer address
   ├─ Stores transaction_hash
   ├─ Sets sold_at timestamp
   └─ Listing removed from active marketplace
```

## Technology Stack Visualization

```
FRONTEND
├── React 18+
├── TypeScript
├── Vite (Build Tool)
├── Tailwind CSS (Styling)
├── React Router (Navigation)
├── Framer Motion (Animations)
├── Radix UI (Components)
├── Ethers.js (Blockchain)
└── Axios (HTTP Requests)
     │
     └─→ MongoDB API Client
         ├── GET /api/users
         ├── GET /api/kyc
         └── GET /api/resale

API SERVER (Node.js)
├── Express.js (Framework)
├── Mongoose (Database ORM)
├── CORS (Cross-origin)
├── Validation (Input checks)
├── Error Handling
└── Nodemon (Auto-reload)
     │
     └─→ MongoDB Driver
         (Connection pooling)

DATABASE (MongoDB)
├── Collections
│   ├── users
│   ├── kyc
│   └── resalelistings
├── Indexes
│   ├── Primary keys
│   ├── Foreign key lookups
│   └── Query optimization
└── Automatic features
    ├── Timestamps
    ├── Validation
    └── Connection pooling

BLOCKCHAIN (Optional)
├── Ethereum/Hardhat
├── Smart Contracts (Solidity)
├── NFT Tokens (ERC-721)
└── Transaction Recording
    └─→ Stored in MongoDB
```

## File Structure with API

```
TicketShield/
├── api/                          ← NEW
│   ├── models/
│   │   ├── User.js
│   │   ├── KYC.js
│   │   └── ResaleListing.js
│   ├── routes/
│   │   ├── users.js
│   │   ├── kyc.js
│   │   └── resale.js
│   ├── server.js
│   ├── seed.js
│   ├── package.json
│   ├── .env
│   └── README.md
│
├── frontend/                     ← UPDATED
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── integrations/
│   │   │   ├── mongodb/         ← API Client
│   │   │   │   └── client.ts
│   │   │   └── contracts/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env
│   └── package.json
│
├── backend/                      ← UNCHANGED
│   ├── contracts/
│   ├── scripts/
│   ├── hardhat.config.cjs
│   └── package.json
│
├── MONGODB_QUICK_START.md       ← NEW
├── MONGODB_SETUP.md             ← NEW
├── SETUP_GUIDE.md               ← NEW
└── package.json
```

## Network Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Computer                            │
│                                                             │
│  ┌─────────────────┐                                        │
│  │  Browser        │                                        │
│  │  localhost:5173 │                                        │
│  └────────┬────────┘                                        │
│           │ http://localhost:3001 (API calls)               │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │  Node.js        │                                        │
│  │  Express API    │                                        │
│  │  localhost:3001 │                                        │
│  └────────┬────────┘                                        │
│           │ mongodb://localhost:27017                       │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │  MongoDB        │                                        │
│  │  Port 27017     │                                        │
│  │  ticketshield   │                                        │
│  │  database       │                                        │
│  └─────────────────┘                                        │
│                                                             │
│  Optional:                                                 │
│  ┌─────────────────┐                                        │
│  │  Hardhat Node   │                                        │
│  │  localhost:8545 │                                        │
│  │  (Blockchain)   │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

## Request/Response Flow

```
React Component
    │
    ├─ Form submission
    ├─ Calls: db.kyc.submit({...})
    │
    ▼
MongoDB API Client (axios)
    │
    ├─ POST http://localhost:3001/api/kyc
    ├─ Content-Type: application/json
    ├─ Body: { user_id, wallet_address, ... }
    │
    ▼
Express Route Handler
    │
    ├─ Receives request
    ├─ Validates input
    │
    ▼
Mongoose Model
    │
    ├─ Validates against schema
    ├─ Creates document
    │
    ▼
MongoDB
    │
    ├─ Inserts document
    ├─ Auto-generates _id
    ├─ Applies indexes
    │
    ▼
API Response
    │
    ├─ 201 Created status
    ├─ Returns: { _id, user_id, status: "pending", ... }
    │
    ▼
Frontend receives response
    │
    ├─ Updates UI state
    ├─ Shows success message
    ├─ Redirects if needed
    │
    ▼
User sees result
```

This architecture ensures:
✅ Type-safe communication (TypeScript)
✅ Automatic timestamps & validation
✅ Fast database queries (indexes)
✅ Scalable design
✅ Easy to extend
✅ Clean separation of concerns

---

For questions, refer to the detailed documentation files!
