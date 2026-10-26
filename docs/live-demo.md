# Live demo: real Sepolia transactions

Three MetaMask accounts play three roles. Every on-chain step shows up on Etherscan, and the app only records it after the server has re-read the transaction receipt.

| Role | App login | MetaMask account | Needs test ETH |
|---|---|---|---|
| Verifier | `demo-verifier@bluecarbon.test` | Account 1 `0x19b2…5f8D` (holds VERIFIER_ROLE) | yes (already funded) |
| NGO (seller) | `demo-sundarbans@bluecarbon.test` | Account 2 "BlueCarbon NGO" | ~0.02 |
| Company (buyer) | `demo-konkan@bluecarbon.test` | Account 3 "BlueCarbon Company" | ~0.02 |

Password for all demo logins: `apps/web/.demo-accounts.local.json`.

Contracts (Sepolia): registry `0x9941E54386dA5bBb389Efdf482C175F0a620b031`, marketplace `0xa0Ff80D20FF18AdF73ee510920656563D22abefA`.

## Before the presentation (once, ~10 minutes)

1. **Fresh demo data** (removes old placeholder wallets):
   ```bash
   cd apps/web && npm run seed:demo:reset && npm run seed:demo
   ```
2. **Restart the dev server** so it picks up the marketplace address: Ctrl+C, then `npm run dev`.
3. **MetaMask:** add Account 2 and Account 3 (account menu → Add account). From Account 1, use **Send** to give each **0.02 Sepolia ETH**.
4. Use **Chrome with MetaMask** at `http://localhost:3000` (the in-app preview browser has no MetaMask).
5. If MetaMask says an account isn't connected to localhost, open MetaMask → the site connection icon → connect that account.

## The demo (about 10 minutes)

**1. Link the NGO wallet** (log in as the NGO, MetaMask on Account 2)
Dashboard → *Link a wallet* card → **Connect MetaMask** → sign the message. Free: a signature, not a transaction. Point out: the server checks the signature, so nobody can register someone else's address.

**2. Link the company wallet** (log out, log in as the company, MetaMask on Account 3)
Dashboard → **Connect MetaMask** → sign.

**3. Verifier issues credits** (log in as the verifier, MetaMask on Account 1)
Dashboard → *Approved projects* → **Sundarbans tidal mangrove restoration** → *Credits* → *Issue credits*.
Quantity `500`, methodology `VM0033 v2.1, tidal wetland restoration`; the crediting period is pre-filled with the next free period. **Issue with MetaMask** → confirm **2 transactions** (register project, issue batch).
Show the step list ending in "Credits issued and verified against the blockchain", and open the Etherscan links.

**4. NGO lists credits** (NGO login, Account 2)
Project page → *Credits* → "500 tCO2e in your wallet" → quantity `200`, price `0.0001` ETH per tCO2e → **List for sale** → confirm **2 transactions** (one-time permission for the marketplace, then the listing).

**5. Company buys** (company login, Account 3)
*Marketplace* → the project → the listing **without** a demo badge → quantity `50` (total 0.005 ETH) → accept terms → **Buy with MetaMask**.
Point out: tokens and ETH swap in one transaction, so a listing can never sell more than the NGO still holds.

**6. Company retires** (still the company)
Dashboard → *Credits you hold* shows 50 tCO2e read live from the chain → **Retire credits** → 20, reason `FY2026 Scope 1 claim` → confirm → the public certificate opens with its transaction link.

**7. Show the chain**
Open the registry and marketplace on Etherscan → *Events*: ProjectRegistered, BatchIssued, Listed, Purchased, CreditsRetired.

## Points to make

- **On-chain:** who owns which credits, issuance, sales and retirement. **Off-chain:** photos, decisions and monitoring, kept private in the database with fingerprints.
- The database never takes the browser's word: every listing, purchase and retirement is written only after the server matches the transaction's event (project, quantity, buyer and seller wallets).
- Only an authorised verifier wallet can issue; retired credits can never move again.
- Seeded records are labelled *Demonstration data*; seeded trades are simulated. The live steps above are real test-network transactions.
- This is a test network: these tokens are records, not legally recognised carbon credits.

## If something goes wrong

- *"Switch MetaMask to …"*: select the account named in the message.
- *"doesn't have enough Sepolia ETH"*: send a little more from Account 1.
- *"already issued" / "batch for this crediting period already exists"*: pick a later crediting period.
- Stuck at *"Waiting for the network"*: Sepolia can take 15–60 seconds; use *Check again* if offered.
