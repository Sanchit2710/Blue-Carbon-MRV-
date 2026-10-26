"use client";

import { Check, CircleDashed, ExternalLink, Loader2, X } from "lucide-react";
import { Contract, ZeroAddress } from "ethers";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { abandonBatch, confirmIssuance, confirmRegistration, prepareIssuance, recordTransaction, type IssuancePlan } from "@/app/admin/chain-actions";
import { fieldClass, labelClass } from "@/components/ActionForm";
import { Button } from "@/components/ui/button";
import { registryAbi } from "@/lib/chain/abi";
import { CHAIN_NAME, REGISTRY_ADDRESS, short, txUrl } from "@/lib/chain/config";
import { connectWallet, walletError } from "@/lib/chain/wallet";

type StepKey = "prepare" | "wallet" | "register" | "issue" | "confirm";
type Status = "todo" | "active" | "done" | "skipped" | "error";
const steps: { key: StepKey; label: string }[] = [
  { key: "prepare", label: "Check the batch" },
  { key: "wallet", label: "Connect your verifier wallet" },
  { key: "register", label: "Register the project on-chain" },
  { key: "issue", label: "Issue the credits" },
  { key: "confirm", label: "Confirm from the blockchain" },
];

// The verifier signs with their own MetaMask; the server then re-reads each receipt before recording anything.
export function IssueCredits({ projectId, defaultRef, defaultStart, defaultEnd }: { projectId: string; defaultRef: string; defaultStart: string; defaultEnd: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Record<StepKey, Status>>({ prepare: "todo", wallet: "todo", register: "todo", issue: "todo", confirm: "todo" });
  const [note, setNote] = useState<Partial<Record<StepKey, string>>>({});
  const [txs, setTxs] = useState<{ label: string; hash: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ hash: string; batchId: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: StepKey, s: Status, n?: string) => { setStatus((x) => ({ ...x, [k]: s })); if (n !== undefined) setNote((x) => ({ ...x, [k]: n })); };

  async function run(form: FormData) {
    setError(null); setRetry(null); setTxs([]); setRunning(true);
    setStatus({ prepare: "active", wallet: "todo", register: "todo", issue: "todo", confirm: "todo" }); setNote({});
    let plan: IssuancePlan | null = null;
    let issueSent = false;
    try {
      const prep = await prepareIssuance({
        projectId, quantity: Number(form.get("quantity")), periodStart: String(form.get("periodStart")), periodEnd: String(form.get("periodEnd")),
        methodology: String(form.get("methodology")), verificationRef: String(form.get("verificationRef")),
      });
      if (!prep.ok) { set("prepare", "error", prep.error); throw new Error(prep.error); }
      plan = prep.data;
      set("prepare", "done", `${Number(plan.quantity) / 100} tCO2e to ${short(plan.owner)}`);

      set("wallet", "active", "Approve in MetaMask…");
      const { signer, address } = await connectWallet();
      const registry = new Contract(REGISTRY_ADDRESS, registryAbi, signer);
      if (!(await registry.hasRole(await registry.VERIFIER_ROLE(), address))) {
        const msg = `${short(address)} isn’t an authorised verifier on ${CHAIN_NAME}. Switch MetaMask to your verifier account.`;
        set("wallet", "error", msg); throw new Error(msg);
      }
      set("wallet", "done", `${short(address)} on ${CHAIN_NAME}`);

      const onchainOwner: string = await registry.projectOwner(plan.onchainProjectId);
      if (plan.registered || onchainOwner !== ZeroAddress) {
        if (onchainOwner.toLowerCase() !== plan.owner.toLowerCase()) {
          const msg = `This project is registered on-chain to ${short(onchainOwner)}, not the organisation’s wallet.`;
          set("register", "error", msg); throw new Error(msg);
        }
        set("register", "skipped", "Already registered");
      } else {
        set("register", "active", "Confirm in MetaMask…");
        const tx = await registry.registerProject(plan.onchainProjectId, plan.owner);
        setTxs((t) => [...t, { label: "Registration", hash: tx.hash }]);
        await recordTransaction({ hash: tx.hash, kind: "register", projectId, from: address });
        set("register", "active", "Waiting for the network…");
        const c = await confirmRegistration({ hash: tx.hash, projectId });
        if (!c.ok) { set("register", "error", c.error); throw new Error(c.error); }
        set("register", "done", "Registered");
      }

      set("issue", "active", "Confirm in MetaMask…");
      const tx = await registry.issueBatch(plan.onchainProjectId, plan.periodStart, plan.periodEnd, plan.methodology, plan.verificationRef, plan.quantity);
      issueSent = true;
      setTxs((t) => [...t, { label: "Issuance", hash: tx.hash }]);
      await recordTransaction({ hash: tx.hash, kind: "issue", projectId, batchId: plan.batchId, from: address });
      set("issue", "done", "Sent");

      set("confirm", "active", "Waiting for the network and checking the receipt…");
      const c = await confirmIssuance({ hash: tx.hash, batchId: plan.batchId });
      if (!c.ok) { setRetry({ hash: tx.hash, batchId: plan.batchId }); set("confirm", "error", c.error); throw new Error(c.error); }
      set("confirm", "done", "Recorded on-chain and in BlueCarbon");
      setDone(true);
      router.refresh();
    } catch (e) {
      const msg = walletError(e);
      setError(msg);
      setStatus((s) => { const k = (Object.keys(s) as StepKey[]).find((x) => s[x] === "active"); return k ? { ...s, [k]: "error" } : s; });
      // Nothing reached the chain for this batch: drop the draft so it can be prepared again cleanly.
      if (plan && !issueSent) await abandonBatch(plan.batchId);
    } finally {
      setRunning(false);
    }
  }

  async function checkAgain() {
    if (!retry) return;
    setRunning(true); setError(null); set("confirm", "active", "Checking the receipt again…");
    const c = await confirmIssuance(retry);
    setRunning(false);
    if (c.ok) { set("confirm", "done", "Recorded on-chain and in BlueCarbon"); setRetry(null); setDone(true); router.refresh(); }
    else { set("confirm", "error", c.error); setError(c.error); }
  }

  const started = Object.values(status).some((s) => s !== "todo");

  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <h3 className="text-xl font-semibold text-mangrove">Issue credits</h3>
      <p className="mt-1 max-w-[62ch] text-muted-foreground">You’ll sign with your verifier wallet in MetaMask. One credit unit is one tCO2e only if the methodology says so; this records the batch, it doesn’t make it a legally recognised credit.</p>

      {!done && (
        <form action={run} className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className={labelClass}><span>Quantity (tCO2e)</span><input name="quantity" type="number" min="0.01" step="0.01" required className={fieldClass} disabled={running} /></label>
          <label className={labelClass}><span>Methodology</span><input name="methodology" required minLength={3} placeholder="e.g. VM0033 v2.1, tidal wetland restoration" className={fieldClass} disabled={running} /></label>
          <label className={labelClass}><span>Crediting period starts</span><input name="periodStart" type="date" required defaultValue={defaultStart} className={fieldClass} disabled={running} /></label>
          <label className={labelClass}><span>Crediting period ends</span><input name="periodEnd" type="date" required defaultValue={defaultEnd} className={fieldClass} disabled={running} /></label>
          <label className={`${labelClass} sm:col-span-2`}><span>Verification reference</span><input name="verificationRef" required minLength={3} defaultValue={defaultRef} className={fieldClass} disabled={running} /></label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={running}>{running ? <><Loader2 className="size-4 animate-spin" aria-hidden />Working…</> : "Issue with MetaMask"}</Button>
          </div>
        </form>
      )}

      {started && (
        <ol className="mt-6 space-y-3 border-t border-border pt-6" aria-live="polite">
          {steps.map((s, i) => {
            const st = status[s.key];
            return (
              <li key={s.key} className="flex gap-3">
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${st === "done" ? "bg-emerald-600 text-white" : st === "error" ? "bg-red-600 text-white" : st === "active" ? "bg-brackish text-white" : "bg-muted text-muted-foreground"}`}>
                  {st === "done" ? <Check className="size-4" /> : st === "error" ? <X className="size-4" /> : st === "active" ? <Loader2 className="size-4 animate-spin" /> : st === "skipped" ? <CircleDashed className="size-4" /> : i + 1}
                </span>
                <span>
                  <span className={st === "todo" ? "text-muted-foreground" : "font-medium"}>{s.label}</span>
                  {note[s.key] && <span className={`block text-sm ${st === "error" ? "text-red-800" : "text-muted-foreground"}`}>{note[s.key]}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {!!txs.length && (
        <ul className="mt-4 space-y-1 text-sm">
          {txs.map((t) => <li key={t.hash}><a href={txUrl(t.hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-mangrove underline-offset-4 hover:underline">{t.label} transaction {short(t.hash)}<ExternalLink className="size-3.5" aria-hidden /></a></li>)}
        </ul>
      )}
      {error && !retry && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {retry && <div className="mt-4 flex flex-wrap items-center gap-3"><p className="text-sm text-red-800">The transaction was sent but couldn’t be confirmed yet.</p><Button type="button" variant="outline" onClick={checkAgain} disabled={running}>Check again</Button></div>}
      {done && <p className="mt-4 rounded-lg border border-teal-200 bg-accent px-4 py-3 text-sm text-mangrove">Credits issued and verified against the blockchain.</p>}
    </div>
  );
}
