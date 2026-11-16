import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface FieldMeta {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
}

/** aria wiring so screen readers announce the hint and the error with the input. */
export function fieldA11y(id: string, hint?: ReactNode, error?: string) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  } as const;
}

export function FieldShell({
  id,
  label,
  hint,
  error,
  className,
  children,
}: FieldMeta & { children: ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}
      <FieldError id={id} error={error} />
    </div>
  );
}

export function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="text-destructive text-sm font-medium">
      {error}
    </p>
  );
}

export function TextField({
  id,
  label,
  hint,
  error,
  className,
  ...inputProps
}: FieldMeta & Omit<ComponentProps<"input">, "id">) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <Input {...inputProps} {...fieldA11y(id, hint, error)} />
    </FieldShell>
  );
}

export function TextareaField({
  id,
  label,
  hint,
  error,
  className,
  ...textareaProps
}: FieldMeta & Omit<ComponentProps<"textarea">, "id">) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <Textarea {...textareaProps} {...fieldA11y(id, hint, error)} />
    </FieldShell>
  );
}
