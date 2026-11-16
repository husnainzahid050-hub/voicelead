import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteFromLink } from "@/components/voice/delete-from-link";
import { slugSchema } from "@/lib/validation";
import { getPublicBusiness } from "@/server/services/intake";

export const metadata: Metadata = {
  title: "Delete your request",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Opened from the private link on the success screen (secret is in the #fragment). */
export default function DeleteRequestPage({ params }: PageProps<"/intake/[businessSlug]/delete">) {
  return (
    <main className="bg-surface flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <Suspense fallback={<CardSkeleton lines={2} label="Loading" />}>
          <Gate params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Gate({ params }: Pick<PageProps<"/intake/[businessSlug]/delete">, "params">) {
  const { businessSlug } = await params;
  if (!slugSchema.safeParse(businessSlug).success) notFound();
  const data = await getPublicBusiness(businessSlug);
  if (!data?.intakeToken) notFound();
  return (
    <Card>
      <CardContent className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Delete your request</h1>
        <DeleteFromLink
          slug={data.business.slug}
          clinicName={data.business.name}
          intakeToken={data.intakeToken}
        />
      </CardContent>
    </Card>
  );
}
