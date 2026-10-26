import { AbiCoder, keccak256 } from "ethers";

// On-chain project id = the Supabase project UUID's 16 bytes, left-aligned in a bytes32.
// Reversible, so an Etherscan reader can map it back to the project.
export function projectIdOf(uuid: string) {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error("invalid project uuid");
  return `0x${hex.padEnd(64, "0")}`;
}

// Crediting period dates (YYYY-MM-DD) as UTC midnight unix seconds.
export function dayToSeconds(day: string) {
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t)) throw new Error("invalid date");
  return BigInt(t / 1000);
}

// Mirrors BlueCarbonRegistry.batchIdOf: uint256(keccak256(abi.encode(projectId, start, end))).
export function batchIdOf(projectId: string, start: bigint, end: bigint) {
  return BigInt(keccak256(AbiCoder.defaultAbiCoder().encode(["bytes32", "uint64", "uint64"], [projectId, start, end])));
}

// Quantities are tCO2e with 2 decimals off-chain; integers in hundredths on-chain.
export function toHundredths(tonnes: number) {
  const h = Math.round(tonnes * 100);
  if (!Number.isSafeInteger(h) || h <= 0) throw new Error("invalid quantity");
  return BigInt(h);
}
