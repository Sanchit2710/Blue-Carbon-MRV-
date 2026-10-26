import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { Logo } from "./Logo";

// Header for public pages (marketplace, project details, certificates).
export async function SiteHeader() {
  const p = await getProfile();
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1 text-[15px]">
          <Link href="/marketplace" className="rounded-md px-3 py-2 text-foreground/80 hover:bg-muted hover:text-foreground">Marketplace</Link>
          {p ? <Button asChild className="h-10"><Link href={`/${p.role}`}>Your dashboard</Link></Button>
            : <><Link href="/login" className="rounded-md px-3 py-2 text-foreground/80 hover:bg-muted hover:text-foreground">Log in</Link>
              <Button asChild className="h-10"><Link href="/signup">Create account</Link></Button></>}
        </nav>
      </div>
    </header>
  );
}
