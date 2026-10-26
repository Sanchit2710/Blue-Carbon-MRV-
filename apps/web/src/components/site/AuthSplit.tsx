import Image from "next/image";
import { Logo } from "./Logo";

type Photo = { src: string; alt: string; credit: string };

// Photo panel is secondary: hidden on small screens so the form is the first thing on a phone.
export function AuthSplit({ photo, caption, children }: { photo: Photo; caption: string; children: React.ReactNode }) {
  return (
    <>
      <aside className="relative hidden overflow-hidden bg-estuary lg:block">
        <Image src={photo.src} alt={photo.alt} fill priority quality={85} sizes="52vw" className="object-cover" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgba(14,34,54,0.85),rgba(14,34,54,0)_55%)]" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="max-w-[30ch] font-display text-3xl font-semibold leading-snug">{caption}</p>
          <p className="mt-6 text-sm text-white/60">Photo: {photo.credit} / Unsplash</p>
        </div>
      </aside>
      <section className="flex flex-col px-5 py-8 sm:px-10 lg:px-16">
        <Logo />
        <div className="my-auto w-full max-w-[400px] self-center py-12">{children}</div>
      </section>
    </>
  );
}
