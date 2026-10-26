import { formatEther, parseEther } from "ethers";

// Prices: people enter ETH per tCO2e; on-chain it is wei per hundredth of a tCO2e.
export function pricePerUnitWei(ethPerTonne: string) {
  const wei = parseEther(ethPerTonne);
  if (wei <= 0n || wei % 100n !== 0n) throw new Error("Use a price with at most 16 decimal places.");
  return wei / 100n;
}
export const ethPerTonne = (perUnitWei: bigint) => formatEther(perUnitWei * 100n);
export const tonnes = (hundredths: bigint) => Number(hundredths) / 100;
