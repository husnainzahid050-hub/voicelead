import { LinkIcon } from "lucide-react";

/** Invalid intake link: shown to patients, so plain and reassuring. */
export default function IntakeNotFound() {
  return (
    <main className="bg-surface flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-sm text-center">
        <LinkIcon aria-hidden="true" className="text-muted-foreground mx-auto size-12" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          This clinic link isn&rsquo;t valid
        </h1>
        <p className="text-muted-foreground mt-2">
          It may be mistyped or the clinic may have changed it. Please ask the clinic for their
          current link, or contact them directly.
        </p>
        <p lang="ur" dir="rtl" className="text-muted-foreground mt-4">
          یہ لنک درست نہیں ہے۔ براہ کرم کلینک سے نیا لنک حاصل کریں۔
        </p>
      </div>
    </main>
  );
}
