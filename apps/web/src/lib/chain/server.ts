import "server-only";
import { Interface, JsonRpcProvider, type LogDescription } from "ethers";
import { registryAbi } from "./abi";
import { CHAIN_ID, REGISTRY_ADDRESS } from "./config";

// Server-side view of the chain: used to confirm what MetaMask reports, never to sign.
const rpc = process.env.SEPOLIA_RPC_URL;
const provider = rpc ? new JsonRpcProvider(rpc, CHAIN_ID, { staticNetwork: true }) : null;
export const registry = new Interface(registryAbi);

// Waits for the transaction, then returns the registry events it emitted.
// Throws unless it succeeded and was sent to our registry contract.
export async function registryEvents(hash: string): Promise<{ from: string; events: LogDescription[] }> {
  if (!provider) throw new Error("SEPOLIA_RPC_URL is not configured on the server");
  const receipt = await provider.waitForTransaction(hash, 1, 180_000);
  if (!receipt) throw new Error("Transaction not found or not confirmed within 3 minutes");
  if (receipt.status !== 1) throw new Error("Transaction failed on-chain (reverted)");
  if (receipt.to?.toLowerCase() !== REGISTRY_ADDRESS.toLowerCase()) throw new Error("Transaction was not sent to the BlueCarbon registry");
  const events = receipt.logs
    .filter((l) => l.address.toLowerCase() === REGISTRY_ADDRESS.toLowerCase())
    .map((l) => registry.parseLog(l))
    .filter((e): e is LogDescription => e !== null);
  return { from: receipt.from, events };
}
