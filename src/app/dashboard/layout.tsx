import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { DashboardNav, DashboardNavSkeleton } from "@/components/dashboard/dashboard-nav";
import { MobileMenu } from "@/components/dashboard/mobile-menu";

/**
 * The shell is static (prerendered). Everything that reads the session sits
 * behind <Suspense>, as Cache Components requires, so the frame paints
 * instantly while the signed-in parts stream in.
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col md:grid md:grid-cols-[16rem_1fr]">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside className="border-border bg-surface hidden border-r p-4 md:flex md:flex-col md:gap-6">
        <Brand href="/dashboard" className="px-2 py-1" />
        <Suspense fallback={<DashboardNavSkeleton />}>
          <DashboardNav />
        </Suspense>
      </aside>

      <header className="border-border relative flex h-16 items-center justify-between border-b px-4 md:hidden">
        <Brand href="/dashboard" />
        <MobileMenu>
          <Suspense fallback={<DashboardNavSkeleton />}>
            <DashboardNav />
          </Suspense>
        </MobileMenu>
      </header>

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
