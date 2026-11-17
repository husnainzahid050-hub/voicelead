import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LeadFilter, LeadListQuery } from "@/lib/schemas/lead";
import { cn } from "@/lib/utils";

const TABS: Array<{ filter: LeadFilter; label: string }> = [
  { filter: "all", label: "All" },
  { filter: "priority", label: "High priority" },
  { filter: "new", label: "New" },
  { filter: "needs_review", label: "Needs review" },
  { filter: "ready_to_contact", label: "Ready to contact" },
  { filter: "contacted", label: "Contacted" },
  { filter: "booked", label: "Booked" },
  { filter: "lost", label: "Lost" },
];

export function leadsHref(query: Partial<LeadListQuery>): string {
  const params = new URLSearchParams();
  if (query.filter && query.filter !== "all") params.set("filter", query.filter);
  if (query.q) params.set("q", query.q);
  if (query.sort && query.sort !== "urgent") params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  return qs ? `/dashboard/leads?${qs}` : "/dashboard/leads";
}

/** Plain links and a GET form: works without JavaScript and keeps state in the URL. */
export function LeadFilters({ query }: { query: LeadListQuery }) {
  return (
    <div className="space-y-4">
      <nav aria-label="Filter leads" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2">
          {TABS.map((tab) => {
            const active = query.filter === tab.filter;
            return (
              <li key={tab.filter}>
                <Link
                  href={leadsHref({ ...query, filter: tab.filter, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-surface",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action="/dashboard/leads" role="search" className="flex flex-wrap gap-2">
        {query.filter !== "all" && <input type="hidden" name="filter" value={query.filter} />}
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Name, phone, reference or service"
            aria-label="Search leads"
            maxLength={80}
            className="pl-9"
          />
        </div>
        <select
          name="sort"
          defaultValue={query.sort}
          aria-label="Sort leads"
          className="border-border-strong bg-background min-h-11 rounded-md border px-3 text-base"
        >
          <option value="urgent">Most urgent first</option>
          <option value="newest">Newest first</option>
        </select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>
    </div>
  );
}
