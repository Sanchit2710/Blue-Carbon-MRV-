import Image from "next/image";
import { Download, FileText, MapPin, Smartphone } from "lucide-react";
import { flagLabel } from "@/lib/evidence/flags";

export type EvidenceRow = {
  id: string; kind: string; sha256: string; mime_type: string; size_bytes: number;
  gps_lat: number | null; gps_lng: number | null; captured_at: string | null; flags: unknown;
  width?: number | null; height?: number | null;
  device_lat?: number | null; device_lng?: number | null; device_accuracy_m?: number | null;
  url?: string; downloadUrl?: string; is_demo?: boolean;
};

const coord = (a: number, b: number) => `${a.toFixed(5)}, ${b.toFixed(5)}`;

export function EvidenceTable({ rows }: { rows: EvidenceRow[] }) {
  if (!rows.length) return <p className="text-muted-foreground">No evidence yet. Photos you add appear here with their checks.</p>;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
      {rows.map((e) => {
        const flags = e.flags as string[];
        return (
          <li key={e.id} className="grid gap-4 p-4 sm:grid-cols-[120px_1fr] sm:p-5">
            <div className="overflow-hidden rounded-lg bg-muted">
              {e.url && e.kind === "photo"
                ? <a href={e.url} target="_blank" rel="noreferrer" aria-label="Open full-size photo"><Image src={e.url} alt="Field evidence photo" width={240} height={240} sizes="120px" className="aspect-square w-full object-cover" /></a>
                : <div className="grid aspect-square place-items-center text-muted-foreground"><FileText className="size-8" aria-hidden /></div>}
            </div>
            <div className="min-w-0 space-y-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-medium text-foreground">{e.kind === "photo" ? "Photo" : "Document"}</span>
                {e.is_demo && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">Demonstration data</span>}
                <span className="tabular text-muted-foreground">{e.captured_at ? `Taken ${new Date(e.captured_at).toISOString().slice(0, 16).replace("T", " ")} UTC` : "No capture time"}</span>
                <span className="tabular text-muted-foreground">{e.width && e.height ? `${e.width} × ${e.height}px, ` : ""}{(e.size_bytes / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />Photo GPS: <span className="tabular text-foreground">{e.gps_lat != null && e.gps_lng != null ? coord(e.gps_lat, e.gps_lng) : "none"}</span></span>
                {e.device_lat != null && e.device_lng != null && <span className="inline-flex items-center gap-1.5"><Smartphone className="size-4" aria-hidden />Phone: <span className="tabular text-foreground">{coord(e.device_lat, e.device_lng)}</span>{e.device_accuracy_m != null && <span>(±{Math.round(e.device_accuracy_m)} m)</span>}</span>}
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground" title={e.sha256}>SHA-256 {e.sha256}</p>
              <div className="flex flex-wrap items-center gap-2">
                {flags.length ? flags.map((f) => <span key={f} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[13px] text-amber-900">{flagLabel(f)}</span>)
                  : <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[13px] text-emerald-900">No automatic flags</span>}
                {e.downloadUrl && <a href={e.downloadUrl} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-mangrove hover:bg-muted"><Download className="size-4" aria-hidden />Download original</a>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
