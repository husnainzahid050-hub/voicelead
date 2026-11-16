import { Mic } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 text-lg font-bold tracking-tight", className)}
    >
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md"
      >
        <Mic className="size-4" />
      </span>
      VoiceLead
    </Link>
  );
}
