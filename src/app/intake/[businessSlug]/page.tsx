import { Clock, MapPin, Phone, PauseCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { IntakeFlow } from "@/components/voice/intake-flow";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { isoDateInTimezone } from "@/lib/dates";
import { textDirection } from "@/lib/intake/language";
import { formatPkPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { slugSchema, type WorkingHours } from "@/lib/validation";
import { getPublicBusiness, type PublicBusinessDTO } from "@/server/services/intake";

export const metadata: Metadata = {
  title: "Send your request",
  description: "Tell the clinic what you need by voice or text. No account required.",
};

export default function IntakePage({ params }: PageProps<"/intake/[businessSlug]">) {
  return (
    <main className="bg-surface flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:py-10">
        <Suspense fallback={<CardSkeleton lines={4} label="Loading the clinic's page" />}>
          <IntakeGate params={params} />
        </Suspense>
      </div>
      <footer className="text-muted-foreground pb-6 text-center text-xs">
        Powered by VoiceLead · Your request goes only to this clinic
      </footer>
    </main>
  );
}

async function IntakeGate({ params }: Pick<PageProps<"/intake/[businessSlug]">, "params">) {
  const { businessSlug } = await params;
  if (!slugSchema.safeParse(businessSlug).success) notFound();

  const data = await getPublicBusiness(businessSlug);
  if (!data) notFound();
  const { business, intakeToken } = data;

  return (
    <div className="space-y-5">
      <ClinicHeader business={business} />
      {business.isActive && intakeToken ? (
        <>
          {business.intakeInstructions && (
            <p
              dir="auto"
              className={cn(
                "text-lg",
                textDirection(business.intakeInstructions) === "rtl" && "font-urdu",
              )}
            >
              {business.intakeInstructions}
            </p>
          )}
          <IntakeFlow
            business={{
              name: business.name,
              slug: business.slug,
              phone: business.phone,
              services: business.services,
            }}
            intakeToken={intakeToken}
            todayIso={isoDateInTimezone(new Date())}
          />
        </>
      ) : (
        <InactiveNotice business={business} />
      )}
    </div>
  );
}

function ClinicHeader({ business }: { business: PublicBusinessDTO }) {
  const initials = business.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <header className="flex items-center gap-4">
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground grid size-14 shrink-0 place-items-center rounded-xl text-xl font-bold"
      >
        {initials}
      </span>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
        {business.address && (
          <p className="text-muted-foreground flex items-start gap-1 text-sm">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {business.address}
          </p>
        )}
      </div>
    </header>
  );
}

function hoursSummary(hours: WorkingHours): string {
  if (hours.length === 0) return "";
  const first = hours[0];
  const sameHours = first && hours.every((h) => h.open === first.open && h.close === first.close);
  if (sameHours && first) {
    const days = hours.map((h) => WEEKDAY_LABELS[h.day].slice(0, 3));
    const range = days.length > 2 ? `${days[0]}–${days[days.length - 1]}` : days.join(", ");
    return `${range}, ${first.open}–${first.close}`;
  }
  return hours.map((h) => `${WEEKDAY_LABELS[h.day].slice(0, 3)} ${h.open}–${h.close}`).join(" · ");
}

function InactiveNotice({ business }: { business: PublicBusinessDTO }) {
  const hours = hoursSummary(business.workingHours);
  return (
    <Card>
      <CardContent className="space-y-4 text-center">
        <PauseCircle aria-hidden="true" className="text-muted-foreground mx-auto size-12" />
        <h2 className="text-xl font-semibold">Online requests are paused</h2>
        <p className="text-muted-foreground">
          {business.name} isn&rsquo;t taking requests through this page right now. Please contact
          the clinic directly.
        </p>
        <a
          href={`tel:${business.phone}`}
          className="bg-primary text-primary-foreground inline-flex min-h-12 items-center gap-2 rounded-md px-5 font-semibold"
        >
          <Phone aria-hidden="true" className="size-5" /> Call {formatPkPhone(business.phone)}
        </a>
        {hours && (
          <p className="text-muted-foreground flex items-center justify-center gap-1 text-sm">
            <Clock aria-hidden="true" className="size-4" /> {hours}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
