import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import type { Role } from "@/lib/auth";
import { Logo } from "./site/Logo";
import { SidebarNav } from "./SidebarNav";

const roleName: Record<Role, string> = { ngo: "NGO / panchayat", company: "Company", admin: "Verifier" };

// Rendered by each role's layout, so the sidebar stays put while pages load.
export function AppShell({ who, role, children }: { who: string; role: Role; children: React.ReactNode }) {
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:py-6">
          <Logo tone="light" />
          <form action={logout} className="lg:hidden"><button className="rounded-md p-2 text-sidebar-foreground/80 hover:bg-sidebar-accent active:scale-95" aria-label="Log out"><LogOut className="size-5" /></button></form>
        </div>
        <div className="px-3 pb-3 lg:flex-1 lg:pb-0"><SidebarNav role={role} /></div>
        <div className="hidden border-t border-sidebar-border px-5 py-4 lg:block">
          <p className="truncate text-sm text-white" title={who}>{who}</p>
          <p className="text-sm text-sidebar-foreground/60">{roleName[role]}</p>
          <form action={logout}><button className="mt-3 inline-flex items-center gap-2 rounded-md text-sm text-sidebar-foreground/80 hover:text-white"><LogOut className="size-4" />Log out</button></form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-12">{children}</main>
    </div>
  );
}

// Page content fades in on arrival (navigation is the user's action, so this is feedback, not decoration).
export function Page({ title, lead, actions, children }: { title: string; lead?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-mangrove sm:text-4xl">{title}</h1>
          {lead && <p className="mt-2 max-w-[62ch] text-lg text-muted-foreground">{lead}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function Planned({ items }: { items: string[] }) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-white/60 p-6">
      <h2 className="text-lg font-semibold text-mangrove">Coming in later releases</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}
