"use client";

import { BrowserProvider, type Eip1193Provider } from "ethers";
import { CHAIN_ID_HEX, CHAIN_NAME } from "./config";

declare global {
  interface Window { ethereum?: Eip1193Provider & { isMetaMask?: boolean } }
}

export const hasWallet = () => typeof window !== "undefined" && !!window.ethereum;

// Connects MetaMask and makes sure it is on the right network (adds Sepolia if missing).
export async function connectWallet() {
  const eth = window.ethereum;
  if (!eth) throw new Error("MetaMask isn’t installed in this browser.");
  await eth.request({ method: "eth_requestAccounts" });
  const current = (await eth.request({ method: "eth_chainId" })) as string;
  if (current.toLowerCase() !== CHAIN_ID_HEX) {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (e) {
      if ((e as { code?: number }).code !== 4902) throw e;
      await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: CHAIN_ID_HEX, chainName: CHAIN_NAME,
        nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"], blockExplorerUrls: ["https://sepolia.etherscan.io"] }] });
    }
  }
  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  return { provider, signer, address: await signer.getAddress() };
}

// Turns MetaMask / ethers errors into something a person can act on.
export function walletError(e: unknown) {
  const err = e as { code?: number | string; shortMessage?: string; message?: string; info?: { error?: { code?: number } } };
  if (err.code === 4001 || err.code === "ACTION_REJECTED" || err.info?.error?.code === 4001) return "You cancelled the request in MetaMask.";
  if (err.code === "INSUFFICIENT_FUNDS") return "This account doesn’t have enough Sepolia ETH for the transaction fee.";
  return err.shortMessage ?? err.message ?? "Something went wrong with the wallet.";
}
