import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-primary text-sm font-semibold">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">We couldn&rsquo;t find that page</h1>
      <p className="text-muted-foreground mt-2">
        The link may be mistyped or no longer active. If a clinic sent you this link, please check
        with them for the current one.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Go to homepage</Link>
      </Button>
    </main>
  );
}
