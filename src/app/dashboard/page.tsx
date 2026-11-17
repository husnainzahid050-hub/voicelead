import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  Inbox,
  PhoneCall,
  QrCode,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { LeadList } from "@/components/leads/lead-list";
import { CardSkeleton } from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { greetingName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { requireBusinessUser, toAuthContext } from "@/server/auth/guards";
import { getDashboardSummary } from "@/server/services/business-settings";
import { getDashboardMetrics } from "@/server/services/leads";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <Suspense fallback={<CardSkeleton lines={4} label="Loading dashboard" />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  const user = await requireBusinessUser();
  const ctx = toAuthContext(user);
  const [summary, metrics] = await Promise.all([
    getDashboardSummary(ctx),
    getDashboardMetrics(ctx),
  ]);
  const maxService = Math.max(1, ...metrics.topServices.map((s) => s.count));

  // Ordered "act now" first; history (booked) last.
  const tiles = [
    {
      label: "High priority",
      value: metrics.highPriority,
      icon: AlertTriangle,
      href: "/dashboard/leads?filter=priority",
      alert: metrics.highPriority > 0,
    },
    {
      label: "Awaiting callback",
      value: metrics.awaitingCallback,
      icon: PhoneCall,
      href: "/dashboard/leads?filter=ready_to_contact",
    },
    {
      label: "New today",
      value: metrics.newToday,
      icon: Sparkles,
      href: "/dashboard/leads?sort=newest",
    },
    {
      label: "Booked (30 days)",
      value: metrics.bookedLast30Days,
      icon: CalendarCheck,
      href: "/dashboard/leads?filter=booked",
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-lg">
        Welcome back, <span className="font-semibold">{greetingName(user.name)}</span>. Here&rsquo;s
        what needs attention at <span className="font-semibold">{summary.businessName}</span>.
      </p>

      {!summary.isActive && (
        <div
          role="status"
          className="border-urgency-high/30 bg-urgency-high-bg text-urgency-high flex items-start gap-3 rounded-md border p-4"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p>
            Your intake page is paused, so patients can&rsquo;t send new requests.
            {user.role === "owner" && (
              <>
                {" "}
                <Link href="/dashboard/settings" className="font-semibold underline">
                  Turn it back on in Settings
                </Link>
                .
              </>
            )}
          </p>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className={cn(
                "bg-background hover:bg-surface block h-full rounded-lg border p-4",
                t.alert ? "border-urgency-emergency/40 bg-urgency-emergency-bg" : "border-border",
              )}
            >
              <t.icon
                aria-hidden="true"
                className={cn("size-5", t.alert ? "text-urgency-emergency" : "text-primary")}
              />
              <p className="mt-2 text-3xl font-bold tabular-nums">{t.value}</p>
              <p className="text-muted-foreground text-sm">{t.label}</p>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="needs-action" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="needs-action" className="text-lg font-semibold">
            Needs action now
          </h2>
          <Button asChild variant="link" className="h-auto min-h-0 px-0">
            <Link href="/dashboard/leads">
              All leads <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </div>
        <LeadList
          leads={metrics.needsAction}
          emptyMessage="You're all caught up. No open requests right now."
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What patients ask for (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.topServices.length === 0 ? (
              <p className="text-muted-foreground text-sm">No requests in the last 30 days.</p>
            ) : (
              <ul className="space-y-3">
                {metrics.topServices.map((s) => (
                  <li key={s.service}>
                    <div className="flex justify-between text-sm">
                      <span>{s.service}</span>
                      <span className="font-semibold tabular-nums">{s.count}</span>
                    </div>
                    <div
                      aria-hidden="true"
                      className="bg-surface-strong mt-1 h-2 overflow-hidden rounded-full"
                    >
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${(s.count / maxService) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2">
            <QrCode aria-hidden="true" className="text-primary size-6" />
            <p className="font-semibold">Get more requests</p>
            <p className="text-muted-foreground">
              Share your intake link on WhatsApp, Google Maps and a QR code at reception.
            </p>
            <Button asChild variant="link" className="h-auto min-h-0 px-0">
              <Link href="/dashboard/intake-link">
                Your intake link <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <p className="text-muted-foreground flex items-center gap-2 pt-2 text-sm">
              <Inbox aria-hidden="true" className="size-4" /> {summary.leadCount} requests captured
              in total
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
