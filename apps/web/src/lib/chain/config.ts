// Public chain settings (safe in the browser). The RPC URL with its API key stays server-only.
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
export const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;
export const CHAIN_NAME = CHAIN_ID === 11155111 ? "Sepolia" : `chain ${CHAIN_ID}`;
export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? "";
export const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ?? "";
const isAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);
export const hasChain = isAddress(REGISTRY_ADDRESS);
export const hasMarket = hasChain && isAddress(MARKETPLACE_ADDRESS);

const explorer = CHAIN_ID === 11155111 ? "https://sepolia.etherscan.io" : "";
export const txUrl = (hash: string) => (explorer ? `${explorer}/tx/${hash}` : "");
export const addressUrl = (a: string) => (explorer ? `${explorer}/address/${a}` : "");
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
