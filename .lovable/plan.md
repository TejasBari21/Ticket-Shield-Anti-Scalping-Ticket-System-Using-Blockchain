

# 🎫 BlockTix — Blockchain Anti-Scalping Ticketing Platform

## Overview
A Web3-native ticketing platform where users connect via MetaMask, event organizers mint tickets as NFTs, and smart contracts enforce fair pricing. Dark theme with neon accents, crypto-native aesthetic.

---

## 🔐 Authentication & Identity
- **MetaMask wallet connection** as the primary auth method (no email/password)
- Wallet address stored in Supabase as user identity
- User profile linked to wallet address (display name, avatar optional)
- Role system: **Buyer**, **Organizer**, **Admin** — stored in a secure `user_roles` table

---

## 🎨 Design & Layout
- **Dark theme** with neon accent colors (electric blue, purple gradients)
- Web3-native aesthetic inspired by OpenSea/Blur
- Responsive sidebar navigation
- Glassmorphism cards, subtle glow effects
- Wallet connection status always visible in the header

---

## 🏠 Pages & Features

### 1. Landing Page
- Hero section with platform value proposition
- How it works (3-step flow: Connect → Browse → Buy)
- Featured upcoming events
- Connect Wallet CTA

### 2. Event Discovery (Buyer)
- Grid/list view of events with filtering (date, category, location, price)
- Event cards showing: name, date, venue, ticket price range, availability
- Search functionality

### 3. Event Detail Page
- Event info (description, venue, date/time, organizer)
- Ticket tiers with pricing and availability
- "Buy Ticket" button (triggers MetaMask transaction simulation)
- Purchase limit indicator (max tickets per wallet)
- Countdown timer for ticket sales start

### 4. My Tickets (Buyer Dashboard)
- List of owned tickets with event details
- QR code generation for check-in (time-locked — activates hours before event)
- Ticket status: Active, Used, Expired
- Controlled resale option: list ticket on official marketplace at capped price
- Transaction history with blockchain tx references

### 5. Official Resale Marketplace
- Browse resale tickets (price capped at face value or organizer-set maximum)
- Filter by event, price
- Purchase flow same as primary sale

### 6. Organizer Dashboard
- **Create Event**: name, description, date, venue, ticket tiers, pricing, max per wallet
- **Manage Events**: view/edit existing events
- **Sales Analytics**: tickets sold, revenue, resale activity
- **Check-in Management**: real-time check-in stats, manual override
- **Resale Settings**: set price cap percentage, enable/disable resale

### 7. Admin Panel
- Platform overview: total events, total tickets, total users
- User management: view wallets, assign roles, flag suspicious activity
- Event moderation: approve/reject organizer events
- Anti-bot monitoring: flag wallets with bulk purchases or suspicious patterns
- Transaction audit log

### 8. Check-in Verification Page
- QR scanner interface for event staff
- Scans ticket QR → verifies against blockchain record (simulated) and Supabase
- Shows: ticket valid/invalid, attendee wallet (truncated), event details
- Marks ticket as "used" to prevent re-entry

---

## 🗄️ Supabase Backend

### Database Tables
- **profiles** — wallet_address, display_name, avatar_url, created_at
- **user_roles** — user_id, role (buyer/organizer/admin)
- **events** — organizer_id, name, description, date, venue, image, status
- **ticket_tiers** — event_id, tier_name, price, total_supply, max_per_wallet
- **tickets** — tier_id, owner_wallet, status (active/used/listed/expired), purchase_tx, token_id
- **resale_listings** — ticket_id, seller_wallet, asking_price, price_cap, status
- **transactions** — ticket_id, from_wallet, to_wallet, price, tx_hash, type (purchase/resale)
- **check_ins** — ticket_id, checked_in_at, checked_in_by

### Security
- RLS policies on all tables
- Role-based access via `has_role()` security definer function
- Organizers can only manage their own events
- Buyers can only view/manage their own tickets

---

## 🦊 MetaMask Integration
- Connect/disconnect wallet flow
- Display wallet address and balance in header
- Simulated transaction signing for ticket purchases
- Wallet-based session management (no traditional auth)

---

## 📱 Key UX Features
- **Anti-bot protection UI**: CAPTCHA or puzzle before purchase
- **Purchase queue**: visual waiting room for high-demand events
- **Time-locked QR codes**: ticket QR only renders within configurable hours before event
- **Toast notifications** for transaction status updates
- **Responsive design** for mobile check-in scanning

---

## 🚀 Development Phases

### Phase 1 — Foundation
- MetaMask wallet auth + Supabase user creation
- Dark Web3 theme and layout shell
- Role system setup

### Phase 2 — Event & Ticketing
- Event CRUD for organizers
- Event discovery and detail pages for buyers
- Ticket purchase flow with MetaMask signing simulation

### Phase 3 — Marketplace & Check-in
- My Tickets dashboard with QR generation
- Resale marketplace with price cap enforcement
- Check-in verification page

### Phase 4 — Admin & Analytics
- Admin panel with monitoring tools
- Organizer analytics dashboard
- Transaction audit log

