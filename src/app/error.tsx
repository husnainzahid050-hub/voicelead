"use client"; // Error boundaries must be Client Components

import { Button } from "@/components/ui/button";

/**
 * Friendly fallback for unexpected errors. Never renders error.message:
 * internal details (database, AI provider, stack traces) must not reach users.
 * Server-side logging is added in Phase 5.
 */
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main
      role="alert"
      className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center"
    >
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground mt-2">
        This is on our side, not yours. Please try again in a moment.
      </p>
      <Button className="mt-6" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
