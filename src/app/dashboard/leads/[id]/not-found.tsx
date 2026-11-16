import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Same response whether the lead never existed, was deleted, or belongs to
 * another clinic: no information leaks about other clinics' data.
 */
export default function LeadNotFound() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <SearchX aria-hidden="true" className="text-muted-foreground size-10" />
        <h1 className="mt-4 text-xl font-semibold">Lead not found</h1>
        <p className="text-muted-foreground mt-1 max-w-sm">
          It may have been deleted, or the link is incorrect.
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/dashboard/leads">Back to leads</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
