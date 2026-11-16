import { Skeleton } from "@/components/skeleton";
import { can } from "@/lib/permissions";
import { requireBusinessUser } from "@/server/auth/guards";
import { NavLinks } from "./nav-links";
import { SignOutButton } from "./sign-out-button";

const ROLE_LABELS = { owner: "Owner", staff: "Staff" } as const;

/** Session-dependent navigation. Always rendered inside a <Suspense> boundary. */
export async function DashboardNav() {
  const user = await requireBusinessUser();
  return (
    <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-6">
      <NavLinks canManageSettings={can(user.role, "settings:read")} />
      <div className="border-border mt-auto border-t pt-4">
        <p className="truncate font-medium">{user.name}</p>
        <p className="text-muted-foreground truncate text-sm">
          {ROLE_LABELS[user.role]} · {user.email}
        </p>
        <div className="mt-3">
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}

export function DashboardNavSkeleton() {
  return (
    <div role="status" aria-label="Loading navigation" className="space-y-2">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
