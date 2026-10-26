import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { photos } from "@/lib/photos";
import { Logo } from "./Logo";

// The one orchestrated moment on the page: a waterline draws across, then the headline rises out of it.
// Pure CSS (see globals.css): no JavaScript needed to show the headline, reduced motion respected.
export function Hero() {
  const p = photos.hero;
  return (
    <section className="relative isolate flex h-[92svh] min-h-[640px] flex-col overflow-hidden bg-estuary text-white">
      <div className="hero-photo absolute inset-0 -z-10">
        <Image src={p.src} alt={p.alt} fill priority quality={85} sizes="100vw" className="object-cover object-[50%_40%]" />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(14,34,54,0.92)_0%,rgba(14,34,54,0.55)_38%,rgba(14,34,54,0.15)_70%,rgba(14,34,54,0.35)_100%)]" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo tone="light" />
        <nav className="flex items-center gap-1 text-[15px]">
          <Link href="/marketplace" className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10 hover:text-white">Marketplace</Link>
          <Link href="/login" className="rounded-md px-3 py-2 text-white/90 hover:bg-white/10 hover:text-white">Log in</Link>
          <Button asChild variant="secondary" className="h-10 bg-white text-mangrove hover:bg-white/90"><Link href="/signup">Create account</Link></Button>
        </nav>
      </header>

      <div className="mx-auto mt-auto w-full max-w-6xl px-5 pb-14 sm:px-8 sm:pb-20">
        <div aria-hidden className="waterline mb-8 h-px bg-white/50" />
        <div className="overflow-hidden pb-2">
          <h1 className="rise max-w-[14ch] text-[clamp(2.75rem,7vw,5.75rem)] font-semibold leading-[0.98]">Proof that the mangroves are growing.</h1>
        </div>
        <div className="fade-late">
          <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-white/85">
            Coastal NGOs submit field evidence from the site, independent verifiers check it, and buyers see exactly what they are funding — before a single credit exists.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-brackish hover:bg-brackish/90"><Link href="#projects">See approved projects</Link></Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link href="/signup">Register a restoration project</Link></Button>
          </div>
        </div>
      </div>
      <p className="absolute bottom-3 right-4 text-xs text-white/55">Photo: {p.credit} / Unsplash</p>
    </section>
  );
}
