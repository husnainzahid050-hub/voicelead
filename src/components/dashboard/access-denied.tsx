import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Shown (server-rendered) when a signed-in user lacks permission for a page. */
export function AccessDenied({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <span className="bg-surface-strong grid size-12 place-items-center rounded-full">
          <Lock aria-hidden="true" className="text-muted-foreground size-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 max-w-sm">{body}</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
