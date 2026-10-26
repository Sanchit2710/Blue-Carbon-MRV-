"use client";

import { Loader2 } from "lucide-react";
import { Contract } from "ethers";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmCancel, confirmListing } from "@/app/market-actions";
import { fieldClass, labelClass } from "@/components/ActionForm";
import { Button } from "@/components/ui/button";
import { marketAbi, registryAbi } from "@/lib/chain/abi";
import { MARKETPLACE_ADDRESS, REGISTRY_ADDRESS, short } from "@/lib/chain/config";
import { toHundredths } from "@/lib/chain/ids";
import { pricePerUnitWei } from "@/lib/chain/units";
import { connectWallet, walletError } from "@/lib/chain/wallet";

async function orgSigner(wallet: string) {
  const { signer, address } = await connectWallet();
  if (address.toLowerCase() !== wallet.toLowerCase()) throw new Error(`Switch MetaMask to your organisation’s wallet ${short(wallet)}.`);
  return signer;
}

// Lists credits at a fixed price. Credits stay in the NGO wallet until someone buys.
export function SellCredits({ batchId, onchainBatchId, max, wallet }: { batchId: string; onchainBatchId: string; max: number; wallet: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sell(form: FormData) {
    setError(null);
    const qty = Number(form.get("quantity"));
    if (!(qty > 0 && qty <= max)) return setError(`Enter between 0.01 and ${max} tCO2e.`);
    try {
      const price = pricePerUnitWei(String(form.get("price")));
      setBusy("Connecting to MetaMask…");
      const signer = await orgSigner(wallet);
      const registry = new Contract(REGISTRY_ADDRESS, registryAbi, signer);
      if (!(await registry.isApprovedForAll(wallet, MARKETPLACE_ADDRESS))) {
        setBusy("Allow the marketplace to transfer credits when sold (one-time, in MetaMask)…");
        await (await registry.setApprovalForAll(MARKETPLACE_ADDRESS, true)).wait();
      }
      setBusy("Confirm the listing in MetaMask…");
      const tx = await new Contract(MARKETPLACE_ADDRESS, marketAbi, signer).list(onchainBatchId, toHundredths(qty), price);
      setBusy("Waiting for the network and checking the receipt…");
      const r = await confirmListing({ hash: tx.hash, batchId });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setError(walletError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <form action={sell} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className={labelClass}><span>Quantity to list (tCO2e)</span><input name="quantity" type="number" min="0.01" step="0.01" max={max} required className={fieldClass} disabled={!!busy} /></label>
      <label className={labelClass}><span>Price per tCO2e (Sepolia ETH)</span><input name="price" type="number" min="0.000001" step="any" required placeholder="0.001" className={fieldClass} disabled={!!busy} /></label>
      <Button type="submit" disabled={!!busy}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}{busy ? "Working…" : "List for sale"}</Button>
      {(busy || error) && <p className={`text-sm sm:col-span-3 ${error ? "text-red-800" : "text-muted-foreground"}`}>{error ?? busy}</p>}
    </form>
  );
}

export function CancelListing({ listingId, onchainListingId, wallet }: { listingId: string; onchainListingId: number; wallet: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cancel() {
    setBusy(true); setError(null);
    try {
      const signer = await orgSigner(wallet);
      const tx = await new Contract(MARKETPLACE_ADDRESS, marketAbi, signer).cancel(onchainListingId);
      const r = await confirmCancel({ hash: tx.hash, listingId });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (e) { setError(walletError(e)); } finally { setBusy(false); }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={cancel} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Stop selling"}</Button>
      {error && <span className="text-sm text-red-800">{error}</span>}
    </span>
  );
}
