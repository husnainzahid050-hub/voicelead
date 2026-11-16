"use client";

import { Menu, X } from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Collapsible navigation for small screens. Closes when a link inside it is
 * followed. (It deliberately doesn't read the pathname: this sits in the
 * layout's static shell, where request data would block prerendering.)
 */
export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  function closeOnLink(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </Button>
      {open && (
        // Delegated click: the links inside handle keyboard activation themselves.
        <div
          id="mobile-nav"
          onClick={closeOnLink}
          className="border-border bg-background absolute inset-x-0 top-full z-20 flex flex-col border-b p-4 shadow-md"
        >
          {children}
        </div>
      )}
    </>
  );
}
