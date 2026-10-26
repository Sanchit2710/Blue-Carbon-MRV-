export type EvidenceRow = {
  id: string; kind: string; sha256: string; gps_lat: number | null; gps_lng: number | null;
  captured_at: string | null; flags: unknown; mime_type: string; url?: string;
};

export function EvidenceTable({ rows }: { rows: EvidenceRow[] }) {
  if (!rows.length) return <p className="text-sm text-slate-600">No evidence uploaded.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-stone-100 text-xs uppercase text-slate-500"><tr>
          {rows.some((r) => r.url) && <th className="p-2">File</th>}
          <th className="p-2">Type</th><th className="p-2">SHA-256</th><th className="p-2">GPS</th><th className="p-2">Captured (UTC)</th><th className="p-2">Flags</th>
        </tr></thead>
        <tbody>{rows.map((e) => (
          <tr key={e.id} className="border-t border-slate-100 align-top">
            {rows.some((r) => r.url) && (
              <td className="p-2">{e.url ? (e.kind === "photo"
                // eslint-disable-next-line @next/next/no-img-element
                ? <a href={e.url} target="_blank" rel="noreferrer"><img src={e.url} alt="Uploaded field evidence" className="h-16 w-16 rounded object-cover" /></a>
                : <a href={e.url} target="_blank" rel="noreferrer" className="text-teal-800 underline">Open PDF</a>) : "—"}</td>
            )}
            <td className="p-2">{e.kind}</td>
            <td className="p-2 font-mono text-xs break-all" title={e.sha256}>{e.sha256.slice(0, 16)}…</td>
            <td className="p-2">{e.gps_lat != null ? `${e.gps_lat.toFixed(5)}, ${e.gps_lng?.toFixed(5)}` : "—"}</td>
            <td className="p-2">{e.captured_at ? new Date(e.captured_at).toISOString().replace("T", " ").slice(0, 16) : "—"}</td>
            <td className="p-2 text-xs text-amber-800">{(e.flags as string[]).join(", ") || "none"}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}
