"use client";

import { Inbox, LayoutDashboard, QrCode, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS: Array<{ href: string; label: string; icon: LucideIcon; ownerOnly?: boolean }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/leads", label: "Leads", icon: Inbox },
  { href: "/dashboard/intake-link", label: "Intake link", icon: QrCode },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, ownerOnly: true },
];

export function NavLinks({ canManageSettings }: { canManageSettings: boolean }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {ITEMS.filter((item) => !item.ownerOnly || canManageSettings).map((item) => {
        const active =
          item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 font-medium transition-colors",
                active
                  ? "bg-primary-soft text-status-new"
                  : "text-muted-foreground hover:bg-surface-strong hover:text-foreground",
              )}
            >
              <item.icon aria-hidden="true" className="size-5" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
