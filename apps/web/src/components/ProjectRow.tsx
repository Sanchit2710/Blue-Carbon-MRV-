import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

const ecosystemName: Record<string, string> = { mangrove: "Mangrove", seagrass: "Seagrass", salt_marsh: "Salt marsh", other: "Coastal wetland" };

export function ProjectRow({ href, name, ecosystem, region, extra, status }: { href: string; name: string; ecosystem: string; region: string; extra?: string; status: string }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{name}</p>
          <p className="truncate text-sm text-muted-foreground">{ecosystemName[ecosystem] ?? ecosystem} in {region}{extra ? `, ${extra}` : ""}</p>
        </div>
        <StatusBadge status={status} />
        <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}
