"use client";

import { Loader2, LogOut } from "lucide-react";
import { useTransition } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

/**
 * Signs out, then does a full page load. Next.js keeps visited pages alive
 * (hidden) for instant back-navigation; a hard reload discards them so the
 * next person at a shared reception computer cannot see the previous user's data.
 */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutAction();
          window.location.replace("/sign-in");
        })
      }
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="animate-spin" />
      ) : (
        <LogOut aria-hidden="true" />
      )}
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
