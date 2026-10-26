"use client";

import { Loader2 } from "lucide-react";
import { Contract } from "ethers";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmRetirement, simulateRetirement } from "@/app/market-actions";
import { fieldClass, labelClass } from "@/components/ActionForm";
import { Button } from "@/components/ui/button";
import { registryAbi } from "@/lib/chain/abi";
import { REGISTRY_ADDRESS, short } from "@/lib/chain/config";
import { toHundredths } from "@/lib/chain/ids";
import { connectWallet, walletError } from "@/lib/chain/wallet";

// Retirement burns the credits from the company wallet permanently; the server then records it from the receipt.
export function RetireCredits({ batchId, onchainBatchId, max, wallet, companyName, demo = false }: { batchId: string; onchainBatchId: string | null; max: number; wallet: string | null; companyName: string; demo?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retire(form: FormData) {
    setError(null);
    const qty = Number(form.get("quantity"));
    const beneficiary = String(form.get("beneficiary") ?? "").trim();
    const reason = String(form.get("reason") ?? "").trim();
    if (!(qty > 0 && qty <= max)) return setError(`Enter between 0.01 and ${max} tCO2e.`);
    if (!form.get("confirm")) return setError("Tick the box to confirm retirement is permanent.");
    if (demo) {
      setBusy("Recording the simulated retirement…");
      const r = await simulateRetirement({ batchId, quantity: qty, beneficiary, reason });
      setBusy(null);
      return r.ok ? router.push(`/retirements/${r.data.retirementId}`) : setError(r.error);
    }
    if (!wallet || !onchainBatchId) return setError("Link your company wallet first.");
    try {
      setBusy("Connecting to MetaMask…");
      const { signer, address } = await connectWallet();
      if (address.toLowerCase() !== wallet!.toLowerCase()) throw new Error(`Switch MetaMask to your company wallet ${short(wallet!)}.`);
      setBusy("Confirm the retirement in MetaMask…");
      const tx = await new Contract(REGISTRY_ADDRESS, registryAbi, signer).retire(onchainBatchId!, toHundredths(qty), address, `${reason} (for ${beneficiary})`);
      setBusy("Waiting for the network and checking the receipt…");
      const r = await confirmRetirement({ hash: tx.hash, batchId, beneficiary });
      if (!r.ok) throw new Error(r.error);
      router.push(`/retirements/${r.data.retirementId}`);
    } catch (e) {
      setError(walletError(e));
    } finally {
      setBusy(null);
    }
  }

  if (!open) return <Button type="button" variant="outline" onClick={() => setOpen(true)}>{demo ? "Retire credits (demo)" : "Retire credits"}</Button>;
  return (
    <form action={retire} className="mt-4 grid gap-4 rounded-lg border border-border bg-stone-50 p-4 sm:grid-cols-2">
      <label className={labelClass}><span>Quantity (tCO2e)</span><input name="quantity" type="number" min="0.01" step="0.01" max={max} required className={fieldClass} disabled={!!busy} /></label>
      <label className={labelClass}><span>On behalf of</span><input name="beneficiary" required minLength={2} defaultValue={companyName} className={fieldClass} disabled={!!busy} /></label>
      <label className={`${labelClass} sm:col-span-2`}><span>Reason, recorded publicly on-chain</span><input name="reason" required minLength={3} maxLength={200} placeholder="e.g. FY2026 offset claim, Scope 1" className={fieldClass} disabled={!!busy} /></label>
      <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="confirm" className="mt-1 size-4 accent-[#2f7c78]" />Retired credits are permanently removed and can never be sold or transferred again.</label>
      {error && <p className="text-sm text-red-800 sm:col-span-2">{error}</p>}
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" disabled={!!busy}>{busy ? <><Loader2 className="size-4 animate-spin" aria-hidden />{busy}</> : demo ? "Simulate retirement (demo)" : "Retire with MetaMask"}</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={!!busy}>Cancel</Button>
      </div>
    </form>
  );
}
