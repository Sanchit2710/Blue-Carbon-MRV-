"use client";

import { Camera, FileText, ImageUp, Loader2, MapPin, MapPinOff, RotateCcw } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/app/(auth)/actions";
import { uploadEvidence } from "@/app/ngo/actions";
import { Button } from "@/components/ui/button";

type Loc = { status: "idle" | "pending" | "denied" | "unavailable" } | { status: "ok"; lat: number; lng: number; acc: number };
const MIN_LONG_EDGE = 1600;
const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

// The phone's own camera app is used (capture="environment"): full sensor resolution, EXIF intact.
// The file is sent exactly as captured — no canvas, no recompression — so its hash matches the original.
export function EvidenceCapture({ projectId }: { projectId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [loc, setLoc] = useState<Loc>({ status: "idle" });

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setDims(null); setLoc({ status: "idle" });
    if (input.current) input.current.value = "";
  };
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await uploadEvidence(prev, fd);
    if (r.notice) clear();
    return r;
  }, {});

  function pick(capture: boolean) {
    const el = input.current!;
    if (capture) el.setAttribute("capture", "environment"); else el.removeAttribute("capture");
    el.click();
  }

  function locate() {
    if (!("geolocation" in navigator)) return setLoc({ status: "unavailable" });
    setLoc({ status: "pending" });
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc({ status: "ok", lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      (e) => setLoc({ status: e.code === e.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setDims(null);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
      const img = new Image();
      img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = url;
      locate();
    } else { setPreview(null); setLoc({ status: "idle" }); }
  }

  const lowRes = dims && Math.max(dims.w, dims.h) < MIN_LONG_EDGE;

  return (
    <MotionConfig reducedMotion="user">
      <form action={formAction} className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <input type="hidden" name="project_id" value={projectId} />
        <input ref={input} type="file" name="file" accept="image/*,application/pdf" onChange={onChange} className="sr-only" tabIndex={-1} aria-hidden />
        {loc.status === "ok" && (<>
          <input type="hidden" name="device_lat" value={loc.lat} />
          <input type="hidden" name="device_lng" value={loc.lng} />
          <input type="hidden" name="device_accuracy_m" value={loc.acc} />
        </>)}

        <AnimatePresence mode="wait" initial={false}>
          {!file ? (
            <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <h3 className="text-lg font-semibold text-mangrove">Add field evidence</h3>
              <p className="mt-1 max-w-[60ch] text-muted-foreground">Take the photo here so it keeps its full quality, time and location. Originals up to 25 MB are saved exactly as taken.</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button type="button" size="lg" onClick={() => pick(true)}><Camera className="size-5" aria-hidden />Take photo</Button>
                <Button type="button" size="lg" variant="outline" onClick={() => pick(false)}><ImageUp className="size-5" aria-hidden />Choose photo or PDF</Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="grid gap-5 sm:grid-cols-[minmax(0,240px)_1fr]">
              <div className="overflow-hidden rounded-lg bg-muted">
                {preview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={preview} alt="Preview of the selected evidence" className="aspect-[4/3] w-full object-cover" />
                  : <div className="grid aspect-[4/3] place-items-center text-muted-foreground"><FileText className="size-10" aria-hidden /></div>}
              </div>
              <div className="min-w-0 space-y-3">
                <p className="truncate font-medium text-foreground" title={file.name}>{file.name}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Size</dt><dd className="tabular">{mb(file.size)} MB, saved without compression</dd>
                  {dims && (<><dt className="text-muted-foreground">Resolution</dt><dd className="tabular">{dims.w} × {dims.h}px</dd></>)}
                  {preview && (<>
                    <dt className="text-muted-foreground">Phone location</dt>
                    <dd className="flex items-center gap-1.5">
                      {loc.status === "pending" && <><Loader2 className="size-4 animate-spin" aria-hidden />Finding your location…</>}
                      {loc.status === "ok" && <><MapPin className="size-4 text-brackish" aria-hidden /><span className="tabular">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} (±{loc.acc} m)</span></>}
                      {(loc.status === "denied" || loc.status === "unavailable") && <><MapPinOff className="size-4 text-amber-700" aria-hidden />{loc.status === "denied" ? "Permission denied." : "Not available."} <button type="button" onClick={locate} className="font-medium text-mangrove underline underline-offset-4">Try again</button></>}
                    </dd>
                  </>)}
                </dl>
                {lowRes && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">This looks like a low-resolution copy. If you can, upload the original from the camera.</p>}
                {file.size > 25 * 1024 * 1024 && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">This file is over 25 MB and can’t be uploaded.</p>}
                <div className="flex flex-wrap gap-3 pt-1">
                  <Button type="submit" disabled={pending || loc.status === "pending" || file.size > 25 * 1024 * 1024}>
                    {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}{pending ? "Uploading original…" : "Upload evidence"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { clear(); pick(!!preview); }} disabled={pending}><RotateCcw className="size-4" aria-hidden />{preview ? "Retake" : "Choose another"}</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div aria-live="polite" className="mt-4 empty:mt-0">
          {state.error && <p className="animate-in fade-in slide-in-from-top-1 duration-200 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 motion-reduce:animate-none">{state.error}</p>}
          {state.notice && <p className="animate-in fade-in slide-in-from-top-1 duration-200 rounded-lg border border-teal-200 bg-accent px-4 py-3 text-sm text-mangrove motion-reduce:animate-none">{state.notice}</p>}
        </div>
      </form>
    </MotionConfig>
  );
}
