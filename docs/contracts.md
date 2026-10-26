# Smart contracts (`contracts/`)

One contract: `BlueCarbonRegistry` (ERC-1155 + AccessControl + Pausable, OpenZeppelin v5, Solidity 0.8.24).
Hardhat (TypeScript). Nothing is deployed; tests run on the local Hardhat network.

> **Legal status.** An on-chain token is **not** automatically a legally recognised carbon credit.
> It is a tamper-evident record of what this platform's verifiers issued. Whether it counts as a
> credit (for compliance, claims, or offsetting) depends on the crediting program / registry
> that recognises the methodology and issuance. Do not market tokens as certified credits unless a program does.

## Design

| Concern | Choice | Why |
|---|---|---|
| Token standard | ERC-1155, `tokenId = batchId` | One contract for all batches; each batch is fungible within itself, distinct across batches (different project/period/methodology). Avoids deploying an ERC-20 per batch. |
| Quantity unit | integer, hundredths of a tCO2e | Mirrors `credit_batches.*_qty numeric(14,2)`. `100.00` t = `10000`. |
| Issuance | `issueBatch` mints to the project's registered owner address | Verifier cannot mint to arbitrary addresses. |
| Retirement | burn from caller; `retiredTotal(batchId)` accumulates | Burned credits cannot be transferred or re-retired; supply visibly shrinks, retired count preserved. |
| Pause | admin `pause()` blocks register/issue/milestone/retire/transfer | Emergency stop only. |
| Upgradeability | none | Keep it simple; redeploy + migrate if needed. |
| Penalties | none | Milestones are records only. |

## Roles

- `DEFAULT_ADMIN_ROLE`: grant/revoke roles, `pause()`/`unpause()`. Constructor grants admin both roles.
- `VERIFIER_ROLE`: `registerProject`, `issueBatch`, `recordMilestone`.
- Any holder: transfer and `retire` their own balance.

## Functions

- `registerProject(bytes32 projectId, address owner)` — rejects zero id, zero owner, duplicates.
- `issueBatch(projectId, uint64 periodStart, uint64 periodEnd, string methodology, string verificationRef, uint256 quantity)` — rejects unregistered project, zero quantity, `periodEnd <= periodStart`, duplicate batch.
- `retire(batchId, quantity, beneficiary, reason)` — rejects unknown batch, zero qty, qty > caller balance.
- `recordMilestone(projectId, milestoneIndex, bytes32 evidenceHash, Outcome outcome)` — `Outcome`: `Pass=0, Fail=1, Flagged=2`. Re-recording an index overwrites stored state; full history is in events.
- Views: `batchIdOf`, `getBatch`, `retiredTotal`, `projectOwner`, `milestones`.

## Events

| Event | Emitted on |
|---|---|
| `ProjectRegistered(projectId, owner)` | registerProject |
| `BatchIssued(batchId, projectId, periodStart, periodEnd, methodology, verificationRef, quantity, to)` | issueBatch |
| `CreditsRetired(batchId, holder, beneficiary, quantity, reason)` | retire |
| `MilestoneRecorded(projectId, milestoneIndex, evidenceHash, outcome)` | recordMilestone |
| ERC-1155 `TransferSingle` / `TransferBatch` | mint, transfer, burn |
| AccessControl `RoleGranted` / `RoleRevoked`; Pausable `Paused` / `Unpaused` | role / pause changes |

## Off-chain ID mapping

- **Project**: Supabase `projects.id` (uuid) → `bytes32` by left-padding the 16 UUID bytes with zeros:
  `projectId = "0x" + uuid.replaceAll("-", "").padStart(64, "0")`.
- **Batch**: deterministic, so no id needs to be stored before issuance:
  `batchId = uint256(keccak256(abi.encode(bytes32 projectId, uint64 periodStart, uint64 periodEnd)))`
  (call `batchIdOf`). Store it as decimal/hex string in `credit_batches.onchain_batch_id`. The unique
  `(project_id, period_start, period_end)` constraint in Postgres matches the on-chain duplicate guard.
- **Period**: unix seconds (`uint64`) from `period_start` / `period_end` dates (use UTC midnight consistently).
- **Quantity**: `Math.round(issued_qty * 100)`.
- `methodology` and `verification_ref` map to the same-named columns; `verification_ref` should be a hash or content URI of the verification report.
- **Milestone**: `milestoneIndex` is the off-chain milestone sequence number; `evidenceHash` is keccak256/sha256 of the evidence file (consistent choice).

## Run

```bash
cd contracts && npm install && npx hardhat test
```

Deploy script `scripts/deploy.ts` reads `RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `CHAIN_ID`, `ADMIN_ADDRESS`, `BASE_URI` from `contracts/.env` (git-ignored; see `.env.example`). It has not been run against any live network. Network name: `target`.

## Limitations

- Verifier is a single role; no multisig / timelock, no per-project verifier scoping. Use a multisig as admin for real use.
- Metadata URI is a single base URI; no per-batch metadata beyond on-chain fields.
- Milestone overwrite keeps only the latest on-chain; history is event-only.
- `pause` also freezes retirement and holder transfers.
- Marketplace / purchase contract is out of scope (later phase). ERC-1155 `setApprovalForAll` is available for a future marketplace.
- No gas optimisation or external audit.

## Deployments

| Network | Address | Admin / verifier |
|---|---|---|
| Sepolia (11155111) | Registry [`0x9941E54386dA5bBb389Efdf482C175F0a620b031`](https://sepolia.etherscan.io/address/0x9941E54386dA5bBb389Efdf482C175F0a620b031) | `0x19b212Fc41790dCF8A8f1704928Aeda6c6495f8D` |
| Sepolia (11155111) | Marketplace [`0xa0Ff80D20FF18AdF73ee510920656563D22abefA`](https://sepolia.etherscan.io/address/0xa0Ff80D20FF18AdF73ee510920656563D22abefA) | (no roles; anyone can list/buy) |

Deployed 2026-10-26 with `npx hardhat run scripts/deploy.ts --network target`; roles checked with `REGISTRY_ADDRESS=… npx hardhat run scripts/verify-roles.ts --network target`. Details in `contracts/deployments/sepolia.json`. Source is not yet verified on Etherscan (needs an Etherscan API key).
