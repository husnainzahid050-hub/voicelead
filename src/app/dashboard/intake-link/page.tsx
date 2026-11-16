import { Download, ExternalLink, PartyPopper, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { Suspense } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { CopyButton } from "@/components/intake-link/copy-button";
import { CardSkeleton } from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { env } from "@/lib/env";
import { requireBusinessUser, toAuthContext } from "@/server/auth/guards";
import { getIntakeLinkInfo } from "@/server/services/business-settings";

export const metadata: Metadata = { title: "Intake link" };

export default function IntakeLinkPage({ searchParams }: PageProps<"/dashboard/intake-link">) {
  return (
    <>
      <PageHeader
        title="Your intake link"
        description="Patients open this link to describe what they need, by voice or text. No app or account required."
      />
      <Suspense fallback={<CardSkeleton lines={3} label="Loading intake link" />}>
        <IntakeLinkPanel searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function IntakeLinkPanel({
  searchParams,
}: Pick<PageProps<"/dashboard/intake-link">, "searchParams">) {
  const user = await requireBusinessUser();
  const info = await getIntakeLinkInfo(toAuthContext(user));
  const welcome = (await searchParams).welcome === "1";

  const url = new URL(`/intake/${info.slug}`, env.APP_URL).toString();
  // QR rendered on the server as SVG and embedded as a data: image (allowed by CSP).
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  const qrDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return (
    <div className="space-y-6">
      {welcome && (
        <div
          role="status"
          className="border-success/30 bg-status-booked-bg text-success flex items-start gap-3 rounded-md border p-4"
        >
          <PartyPopper aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p>
            <span className="font-semibold">{info.businessName} is set up.</span> Share the link
            below so patients can reach you any time, even after hours.
          </p>
        </div>
      )}

      {!info.isActive && (
        <div
          role="status"
          className="border-urgency-high/30 bg-urgency-high-bg text-urgency-high flex items-start gap-3 rounded-md border p-4"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p>
            This link is paused. Patients will see a message that you aren&rsquo;t taking requests.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Link</CardTitle>
          <CardDescription>
            Paste it into your WhatsApp Business away message and Google profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input readOnly value={url} aria-label="Intake link" className="font-mono text-sm" />
          <div className="flex flex-wrap gap-3">
            <CopyButton value={url} />
            <Button asChild variant="secondary">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" /> Test your intake page
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR code</CardTitle>
          <CardDescription>
            Print it for your reception desk, waiting room or clinic door.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, nothing for next/image to optimise */}
          <img
            src={qrDataUri}
            alt={`QR code that opens ${info.businessName}'s intake page`}
            width={200}
            height={200}
            className="border-border rounded-md border"
          />
          <Button asChild variant="secondary">
            <a href={qrDataUri} download={`${info.slug}-intake-qr.svg`}>
              <Download aria-hidden="true" /> Download QR code
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
