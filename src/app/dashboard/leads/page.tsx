import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { LeadFilters, leadsHref } from "@/components/leads/lead-filters";
import { LeadList } from "@/components/leads/lead-list";
import { CardSkeleton } from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import { firstParam, leadListQuerySchema } from "@/lib/schemas/lead";
import { requireBusinessUser, toAuthContext } from "@/server/auth/guards";
import { listLeads } from "@/server/services/leads";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage({ searchParams }: PageProps<"/dashboard/leads">) {
  return (
    <>
      <PageHeader title="Leads" description="Every patient request, most urgent first." />
      <Suspense fallback={<CardSkeleton lines={5} label="Loading leads" />}>
        <LeadsResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LeadsResults({ searchParams }: Pick<PageProps<"/dashboard/leads">, "searchParams">) {
  const ctx = toAuthContext(await requireBusinessUser());
  const params = await searchParams;
  const query = leadListQuerySchema.parse({
    filter: firstParam(params.filter),
    q: firstParam(params.q),
    sort: firstParam(params.sort),
    page: firstParam(params.page),
  });
  const result = await listLeads(ctx, query);
  const deleted = firstParam(params.deleted) === "1";

  return (
    <div className="space-y-4">
      {deleted && (
        <p
          role="status"
          className="bg-status-booked-bg text-success flex items-center gap-2 rounded-md p-3 text-sm"
        >
          <CheckCircle2 aria-hidden="true" className="size-4" /> Lead deleted. Personal details were
          erased.
        </p>
      )}
      <LeadFilters query={query} />
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {result.total === 0
          ? "No leads"
          : `${result.total} ${result.total === 1 ? "lead" : "leads"}`}
        {query.q ? ` matching “${query.q}”` : ""}
      </p>
      <LeadList
        leads={result.items}
        emptyMessage={
          query.q || query.filter !== "all"
            ? "No leads match these filters."
            : "No leads yet. Share your intake link to start receiving requests."
        }
      />
      {result.pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
          {query.page > 1 ? (
            <Button asChild variant="secondary">
              <Link href={leadsHref({ ...query, page: query.page - 1 })}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground text-sm">
            Page {query.page} of {result.pageCount}
          </span>
          {query.page < result.pageCount ? (
            <Button asChild variant="secondary">
              <Link href={leadsHref({ ...query, page: query.page + 1 })}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
