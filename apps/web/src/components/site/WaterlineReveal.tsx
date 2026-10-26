"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { photos } from "@/lib/photos";

// Scroll-expansion media: the photo opens from an inset frame to full width as it scrolls into view.
export function WaterlineReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const inset = useTransform(scrollYProgress, [0, 1], [12, 0]);
  const clipPath = useTransform(inset, (v) => `inset(${v}% ${v}% ${v}% ${v}% round 24px)`);
  const p = photos.underwater;
  return (
    <div ref={ref} className="relative aspect-[16/9] w-full">
      <motion.div className="absolute inset-0" style={reduce ? undefined : { clipPath }}>
        <Image src={p.src} alt={p.alt} fill sizes="100vw" quality={85} className="rounded-3xl object-cover" />
      </motion.div>
    </div>
  );
}
