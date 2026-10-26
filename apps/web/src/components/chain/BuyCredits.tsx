"use client";

import { Loader2 } from "lucide-react";
import { Contract, formatEther } from "ethers";
import Link from "next/link";
import { useState } from "react";
import { confirmPurchase } from "@/app/market-actions";
import { fieldClass, labelClass } from "@/components/ActionForm";
import { Button } from "@/components/ui/button";
import { marketAbi } from "@/lib/chain/abi";
import { CHAIN_NAME, MARKETPLACE_ADDRESS, short } from "@/lib/chain/config";
import { toHundredths } from "@/lib/chain/ids";
import { connectWallet, walletError } from "@/lib/chain/wallet";

type Viewer = { kind: "guest" } | { kind: "other-role" } | { kind: "company"; wallet: string | null };

// Quantity → exact total → terms → MetaMask. A purchase only shows as done after the server confirms the receipt.
export function BuyCredits({ listingId, onchainListingId, available, priceWeiPerUnit, viewer }: {
  listingId: string; onchainListingId: number; available: number; priceWeiPerUnit: string; viewer: Viewer;
}) {
  const [qty, setQty] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  let total: bigint | null = null;
  try { total = Number(qty) > 0 ? toHundredths(Number(qty)) * BigInt(priceWeiPerUnit) : null; } catch { total = null; }

  if (viewer.kind === "guest") return <p className="text-sm text-muted-foreground"><Link href="/login" className="font-medium text-mangrove underline underline-offset-4">Log in with a company account</Link> to buy.</p>;
  if (viewer.kind === "other-role") return <p className="text-sm text-muted-foreground">Only company accounts can buy credits.</p>;
  if (!viewer.wallet) return <p className="text-sm text-muted-foreground">Link your company wallet on <Link href="/company" className="font-medium text-mangrove underline underline-offset-4">your dashboard</Link> before buying.</p>;
  if (done !== null) return <p className="rounded-lg border border-teal-200 bg-accent px-4 py-3 text-sm text-mangrove">Bought {done} tCO2e, confirmed on-chain. <Link href="/company" className="font-medium underline underline-offset-4">See it in your holdings</Link>.</p>;

  async function buy() {
    setError(null);
    const n = Number(qty);
    if (!(n > 0 && n <= available)) return setError(`Enter between 0.01 and ${available} tCO2e.`);
    if (!agree) return setError("Please accept the purchase terms.");
    try {
      setBusy("Connecting to MetaMask…");
      const { signer, address } = await connectWallet();
      if (address.toLowerCase() !== (viewer as { wallet: string }).wallet.toLowerCase()) throw new Error(`Switch MetaMask to your company wallet ${short((viewer as { wallet: string }).wallet)}.`);
      setBusy("Confirm the payment in MetaMask…");
      const tx = await new Contract(MARKETPLACE_ADDRESS, marketAbi, signer).buy(onchainListingId, toHundredths(n), { value: total! });
      setBusy("Waiting for the network and checking the receipt…");
      const r = await confirmPurchase({ hash: tx.hash, listingId });
      if (!r.ok) throw new Error(r.error);
      setDone(r.data.quantity);
    } catch (e) {
      setError(walletError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}><span>Quantity (tCO2e)</span><input type="number" min="0.01" step="0.01" max={available} value={qty} onChange={(e) => setQty(e.target.value)} className={fieldClass} disabled={!!busy} /></label>
        <div className="space-y-2 text-sm"><span className="font-medium">Total</span><p className="tabular flex min-h-11 items-center font-display text-2xl font-semibold text-mangrove">{total !== null ? `${formatEther(total)} ETH` : "—"}</p></div>
      </div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-4 accent-[#2f7c78]" />
        <span>I understand this is a {CHAIN_NAME} test-network transaction: these are records, not legally recognised carbon credits. Buying doesn’t transfer the duty to maintain the site, which stays with the project’s organisation.</span>
      </label>
      {error && <p className="text-sm text-red-800">{error}</p>}
      <Button type="button" onClick={buy} disabled={!!busy || total === null}>{busy ? <><Loader2 className="size-4 animate-spin" aria-hidden />{busy}</> : "Buy with MetaMask"}</Button>
    </div>
  );
}
