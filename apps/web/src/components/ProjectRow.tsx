import Link from "next/link";
import { LinkPending } from "./LinkPending";
import { StatusBadge } from "./StatusBadge";

const ecosystemName: Record<string, string> = { mangrove: "Mangrove", seagrass: "Seagrass", salt_marsh: "Salt marsh", other: "Coastal wetland" };

export function ProjectRow({ href, name, ecosystem, region, extra, status }: { href: string; name: string; ecosystem: string; region: string; extra?: string; status: string }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none active:bg-muted">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{name}</p>
          <p className="truncate text-sm text-muted-foreground">{ecosystemName[ecosystem] ?? ecosystem} in {region}{extra ? `, ${extra}` : ""}</p>
        </div>
        <StatusBadge status={status} />
        <LinkPending />
      </Link>
    </li>
  );
}
