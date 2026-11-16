import { ArrowRight, Inbox, QrCode, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { CardSkeleton } from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireBusinessUser, toAuthContext } from "@/server/auth/guards";
import { getDashboardSummary } from "@/server/services/business-settings";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <Suspense fallback={<CardSkeleton lines={2} label="Loading dashboard" />}>
        <DashboardSummary />
      </Suspense>
    </>
  );
}

async function DashboardSummary() {
  const user = await requireBusinessUser();
  const summary = await getDashboardSummary(toAuthContext(user));

  return (
    <div className="space-y-6">
      <p className="text-lg">
        Welcome back, <span className="font-semibold">{user.name}</span>. You&rsquo;re managing{" "}
        <span className="font-semibold">{summary.businessName}</span>.
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent>
            <Inbox aria-hidden="true" className="text-primary size-6" />
            <p className="mt-3 text-3xl font-bold">{summary.leadCount}</p>
            <p className="text-muted-foreground">
              patient {summary.leadCount === 1 ? "request" : "requests"} captured so far
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <QrCode aria-hidden="true" className="text-primary size-6" />
            <p className="mt-3 font-semibold">Share your intake link</p>
            <p className="text-muted-foreground">
              Put it on WhatsApp, Google Maps and a QR code at reception.
            </p>
            <Button asChild variant="link" className="mt-1 h-auto min-h-0 px-0">
              <Link href="/dashboard/intake-link">
                Get your link <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
