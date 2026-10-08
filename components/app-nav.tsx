"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/pipeline", label: "Pipeline" },
  { href: "/find", label: "Find jobs" },
  { href: "/add", label: "Add jobs" },
  { href: "/profile", label: "My profile" },
  { href: "/stats", label: "Stats" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="scroll-row flex gap-1 rounded-xl bg-muted p-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-[9px] px-3.5 py-2 font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-card text-foreground shadow-sm",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
