"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type FeaturedProject = { id: string; name: string; region: string; ecosystem: string; hectares: number; cover: string; demo: boolean };

// Interactive image accordion: the hovered or focused panel widens; on phones they stack as cards.
export function ProjectAccordion({ projects }: { projects: FeaturedProject[] }) {
  const [active, setActive] = useState(0);
  return (
    <ul className="flex flex-col gap-3 md:h-[440px] md:flex-row">
      {projects.map((p, i) => (
        <li key={p.id} onMouseEnter={() => setActive(i)} className={`relative min-h-56 overflow-hidden rounded-2xl transition-[flex-grow] duration-500 ease-out motion-reduce:transition-none md:min-h-0 ${active === i ? "md:grow-[4]" : "md:grow"}`} style={{ flexBasis: 0 }}>
          <Link href={`/projects/${p.id}`} onFocus={() => setActive(i)} className="group absolute inset-0 block focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-white">
            <Image src={p.cover} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" quality={80} className="object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none" />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgba(14,34,54,0.9),rgba(14,34,54,0.1)_60%)]" />
            <div className={`absolute inset-x-0 bottom-0 p-5 text-white transition-opacity duration-300 ${active === i ? "opacity-100" : "md:opacity-0"}`}>
              {p.demo && <span className="mb-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">Demonstration data</span>}
              <p className="font-display text-2xl font-semibold leading-tight">{p.name}</p>
              <p className="mt-1 text-white/80">{p.region}, {p.hectares} ha</p>
            </div>
            <span className={`absolute bottom-5 left-1/2 hidden max-h-[70%] -translate-x-1/2 rotate-180 truncate whitespace-nowrap text-sm font-medium text-white/90 transition-opacity [writing-mode:vertical-rl] md:block ${active === i ? "opacity-0" : "opacity-100"}`} aria-hidden>{p.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
