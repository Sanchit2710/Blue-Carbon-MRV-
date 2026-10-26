"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";

const nav: Record<Role, { href: string; label: string }[]> = {
  ngo: [{ href: "/ngo", label: "Projects" }, { href: "/ngo/projects/new", label: "Register a project" }],
  company: [{ href: "/company", label: "Overview" }],
  admin: [{ href: "/admin", label: "Review queue" }, { href: "/admin/maintenance", label: "Maintenance" }, { href: "/admin/audit", label: "Audit log" }],
};

export function SidebarNav({ role }: { role: Role }) {
  const path = usePathname();
  const items = nav[role];
  // Most specific match wins so "/ngo" isn't active on "/ngo/projects/new".
  const active = items.filter((i) => path === i.href || path.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active === i.href ? "page" : undefined}
          className="whitespace-nowrap rounded-md px-3 py-2.5 text-[15px] text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-white">
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
