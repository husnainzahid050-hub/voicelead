"use client"; // Error boundaries must be Client Components

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown to patients: plain, bilingual, no technical details. */
export default function IntakeError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main role="alert" className="bg-surface flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground mt-2">
          We couldn&rsquo;t load the clinic&rsquo;s page. Please try again in a moment.
        </p>
        <p lang="ur" dir="rtl" className="text-muted-foreground mt-2">
          کچھ غلط ہو گیا۔ براہ کرم دوبارہ کوشش کریں۔
        </p>
        <Button className="mt-6" onClick={() => retry()}>
          <RefreshCw aria-hidden="true" /> Try again
        </Button>
      </div>
    </main>
  );
}
