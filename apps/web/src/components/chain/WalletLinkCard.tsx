"use client";

import { ExternalLink, Loader2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { linkWallet } from "@/app/wallet-actions";
import { Button } from "@/components/ui/button";
import { addressUrl, CHAIN_NAME, short } from "@/lib/chain/config";
import { walletLinkMessage } from "@/lib/chain/link";
import { connectWallet, hasWallet, walletError } from "@/lib/chain/wallet";

export function WalletLinkCard({ orgId, wallet, locked, purpose = "receive", demo = false }: { orgId: string; wallet: string | null; locked: boolean; purpose?: "receive" | "buy"; demo?: boolean }) {
  const router = useRouter();
  const installed = useSyncExternalStore(() => () => {}, hasWallet, () => true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: string; notice?: string }>({});

  async function link() {
    setMsg({});
    try {
      setBusy("Connecting to MetaMask…");
      const { signer, address } = await connectWallet();
      setBusy("Confirm the signature in MetaMask…");
      const issuedAt = new Date().toISOString();
      const signature = await signer.signMessage(walletLinkMessage(address, orgId, issuedAt));
      setBusy("Verifying…");
      const r = await linkWallet({ address, signature, issuedAt });
      setMsg(r);
      if (r.notice) router.refresh();
    } catch (e) {
      setMsg({ error: walletError(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-white p-5">
      <Wallet className="size-6 text-brackish" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{wallet ? "Credits wallet" : purpose === "buy" ? "Link a wallet to buy and retire credits" : "Link a wallet to receive credits"}</p>
        {wallet ? (
          <p className="text-sm text-muted-foreground">
            <a href={addressUrl(wallet)} target="_blank" rel="noreferrer" className="tabular inline-flex items-center gap-1 font-medium text-mangrove underline-offset-4 hover:underline">{short(wallet)}<ExternalLink className="size-3.5" aria-hidden /></a>
            {" "}on {CHAIN_NAME}{locked ? ". Locked because a project is registered to it." : "."}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {demo ? "Demonstration organisation: link a MetaMask test account to run real Sepolia transactions in a live demo. Seeded demo trades stay simulated. " : null}
            {purpose === "buy" ? `Credits you buy are held in this wallet on ${CHAIN_NAME} (a test network, no real money), and you retire them from it.` : `When a project is approved, its credits are recorded to this wallet on ${CHAIN_NAME} (a test network, no real money).`} You’ll sign a message to prove it’s yours. There’s no fee.
          </p>
        )}
        <div aria-live="polite">
          {msg.error && <p className="mt-2 text-sm text-red-800">{msg.error}</p>}
          {msg.notice && <p className="mt-2 text-sm text-mangrove">{msg.notice}</p>}
        </div>
      </div>
      {!locked && (installed ? (
        <Button type="button" variant={wallet ? "outline" : "default"} onClick={link} disabled={!!busy}>
          {busy ? <><Loader2 className="size-4 animate-spin" aria-hidden />{busy}</> : wallet ? "Change wallet" : "Connect MetaMask"}
        </Button>
      ) : (
        <Button asChild variant="outline"><a href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install MetaMask</a></Button>
      ))}
    </section>
  );
}
