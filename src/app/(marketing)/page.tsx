import { ClipboardCheck, Mic, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UrgencyBadge } from "@/components/ui/badge";

// Phase 1 placeholder. The full marketing page is built in Phase 6.

const steps = [
  {
    icon: Mic,
    title: "Customer speaks",
    body: "Patients open your clinic's link and describe what they need in Urdu or English. No app, no account, no long form.",
  },
  {
    icon: Sparkles,
    title: "VoiceLead organizes it",
    body: "The request becomes a clean lead: name, number, service, urgency and preferred time. It asks only for what's missing.",
  },
  {
    icon: ClipboardCheck,
    title: "You stay in control",
    body: "Review and correct every detail, then copy a ready-made WhatsApp reply. Nothing is sent without you.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-border border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
          <Brand />
          <nav aria-label="Account" className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <p className="text-primary text-sm font-semibold">For dental clinics</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Every after-hours voice message, turned into a lead you can act on.
            </h1>
            <p className="text-muted-foreground mt-4 text-lg">
              VoiceLead captures patient requests while your front desk is closed or busy, and hands
              you a short, organized list of who to call back first.
            </p>
          </div>

          {/* Static illustration of the core transformation. */}
          <Card aria-label="Example: a voice message becomes a structured lead">
            <CardContent className="space-y-4">
              <div className="bg-surface rounded-md p-3">
                <p className="text-muted-foreground text-xs font-medium">Patient said</p>
                <p className="mt-1 italic">
                  &ldquo;Meri daant mein bohat dard ho raha hai. Kal appointment chahiye.&rdquo;
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Service</dt>
                  <dd className="font-medium">Dental pain checkup</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Urgency</dt>
                  <dd>
                    <UrgencyBadge urgency="high" />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Preferred</dt>
                  <dd className="font-medium">Tomorrow, 5 PM</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Next step</dt>
                  <dd className="font-medium">Review &amp; call back</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="how-heading" className="border-border bg-surface border-t">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h2 id="how-heading" className="text-2xl font-bold tracking-tight">
              How it works
            </h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title}>
                  <Card className="h-full">
                    <CardContent>
                      <step.icon aria-hidden="true" className="text-primary size-6" />
                      <h3 className="mt-3 font-semibold">
                        <span className="sr-only">Step {i + 1}: </span>
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground mt-1">{step.body}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex max-w-5xl items-center gap-2 px-4 py-6 text-sm sm:px-6">
          <ShieldCheck aria-hidden="true" className="size-4" />
          Voice recordings are not stored. You review every lead before contacting a patient.
        </div>
      </footer>
    </div>
  );
}
