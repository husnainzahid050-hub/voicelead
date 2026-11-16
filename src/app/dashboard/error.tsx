"use client"; // Error boundaries must be Client Components

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Keeps the dashboard shell (navigation) usable when one page fails.
 * Never shows error details: they may contain internal information.
 */
export default function DashboardError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <Card role="alert">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <h1 className="text-xl font-semibold">This page couldn&rsquo;t load</h1>
        <p className="text-muted-foreground mt-1 max-w-sm">
          Your data is safe. Please try again; if it keeps happening, check your connection.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>
            <RefreshCw aria-hidden="true" /> Try again
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
