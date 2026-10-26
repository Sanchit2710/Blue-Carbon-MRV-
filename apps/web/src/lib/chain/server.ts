import "server-only";
import { Contract, Interface, JsonRpcProvider, type LogDescription } from "ethers";
import { marketAbi, registryAbi } from "./abi";
import { CHAIN_ID, MARKETPLACE_ADDRESS, REGISTRY_ADDRESS } from "./config";

// Server-side view of the chain: used to confirm what MetaMask reports, never to sign.
const rpc = process.env.SEPOLIA_RPC_URL;
const provider = rpc ? new JsonRpcProvider(rpc, CHAIN_ID, { staticNetwork: true }) : null;
export const registry = new Interface(registryAbi);
export const market = new Interface(marketAbi);

// Waits for the transaction, then returns the events `contract` emitted in it.
// Throws unless it succeeded and was sent to that contract.
async function contractEvents(hash: string, contract: string, iface: Interface): Promise<{ from: string; events: LogDescription[] }> {
  if (!provider) throw new Error("SEPOLIA_RPC_URL is not configured on the server");
  const receipt = await provider.waitForTransaction(hash, 1, 180_000);
  if (!receipt) throw new Error("Transaction not found or not confirmed within 3 minutes");
  if (receipt.status !== 1) throw new Error("Transaction failed on-chain (reverted)");
  if (receipt.to?.toLowerCase() !== contract.toLowerCase()) throw new Error("Transaction was not sent to the expected BlueCarbon contract");
  const events = receipt.logs
    .filter((l) => l.address.toLowerCase() === contract.toLowerCase())
    .map((l) => iface.parseLog(l))
    .filter((e): e is LogDescription => e !== null);
  return { from: receipt.from, events };
}

export const registryEvents = (hash: string) => contractEvents(hash, REGISTRY_ADDRESS, registry);
export const marketEvents = (hash: string) => contractEvents(hash, MARKETPLACE_ADDRESS, market);

// Read-only contract handles for balances and listing state.
export const readRegistry = () => (provider ? new Contract(REGISTRY_ADDRESS, registryAbi, provider) : null);
export const readMarket = () => (provider ? new Contract(MARKETPLACE_ADDRESS, marketAbi, provider) : null);
