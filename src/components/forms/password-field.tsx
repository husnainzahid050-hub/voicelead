"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { FieldShell, fieldA11y } from "./field";

export function PasswordField({
  id,
  label,
  hint,
  error,
  ...inputProps
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
} & Omit<ComponentProps<"input">, "id" | "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <Input
          {...inputProps}
          {...fieldA11y(id, hint, error)}
          type={visible ? "text" : "password"}
          className="pr-12"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 grid w-11 place-items-center"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-5" />
          ) : (
            <Eye aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>
    </FieldShell>
  );
}
