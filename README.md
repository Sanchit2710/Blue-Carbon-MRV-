# Blue-Carbon-MRV-
Blockchain-powered MRV system for Blue Carbon ecosystems with AI verification and carbon credit tokenization.

## 🔹 Problem
India lacks a decentralized, verifiable MRV (Monitoring, Reporting, Verification) system for Blue Carbon ecosystems (mangroves, seagrass, salt marshes). Current challenges include fraud, weak verification, and poor transparency.

## 🔹 Solution
We propose a **Blockchain-powered MRV system** with:
-  Smart Contracts for carbon credit tokenization
-  AI + NDVI for satellite-based plantation verification
-  IPFS storage for tamper-proof image evidence
-  Marketplace for NGOs & Companies
-  Regulator dashboard for compliance

## 🔹 Tech Stack
- **Frontend:** React.js, Tailwind, Web3.js
- **Smart Contracts:** Solidity,OpenZeppelin
- **Blockchain:** Polygon PoS (Ethereum compatible, low fees)
- **Storage:** IPFS/Filecoin
- **AI Verification:** Python, NDVI (Google Earth Engine), TensorFlow/PyTorch
- **Backend:** Node.js, Express, MongoDB

## 🔹 Repository Structure
- `/frontend` → React-based web portal
- `/smart-contracts` → Solidity contracts for registry & carbon tokens
- `/backend` → Node.js server for APIs
- `/ai-verification` → Scripts for satellite/geo verification
- `/docs` → Pitch deck, wireframes, diagrams

## 🔹 Roadmap
- Phase 1: NGO onboarding + blockchain registry
- Phase 2: AI verification (satellite + drone integration)
- Phase 3: Corporate marketplace & dashboards

## 🔹 Team
Team CarbCoders — SIH 2025 Hackathon

## 🔹 Running locally (Phase 1)
Active code: `apps/web` (Next.js 16), `supabase/` (schema, seed, tests), `docs/`.
```bash
cd apps/web && cp .env.example .env.local   # fill Supabase URL + anon key
npm install && npm run dev
```
Apply `supabase/migrations/*.sql` in order (see `docs/supabase-setup.md` for the full end-to-end test walkthrough). Contracts: `cd contracts && npx hardhat test` (see `docs/contracts.md`). Optional demo data: `supabase/seed.sql` (flagged `is_demo`).
Promote a verifier: `update profiles set role = 'admin' where id = '<user uuid>';`
See `docs/architecture.md` for what is implemented vs planned. The stack list above describes the original proposal; the current plan is Next.js + Supabase + Hardhat.

## 🔹 Demo data
Clearly labelled demonstration data (2 NGOs, 2 companies, 1 verifier, 5 projects at every stage, evidence photos, decisions, monitoring, credits, listings, simulated purchases and retirements):
```bash
cd apps/web
npm run seed:demo          # needs SUPABASE_SECRET_KEY in .env.local and migrations 0001-0007 applied
npm run seed:demo:reset    # removes all demo data and demo accounts
```
Demo account emails and the shared password are written to `apps/web/.demo-accounts.local.json` (git-ignored). Demo trades are simulated (no blockchain transaction) and labelled as such throughout the app.
