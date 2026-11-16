"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { IDLE, type ActionState } from "@/lib/action-state";

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Submits via onSubmit instead of `<form action>`, because React resets
 * uncontrolled fields after a form action completes — that would wipe what
 * the user typed whenever the server returns a validation error.
 *
 * `beforeSubmit` may return false to cancel (e.g. client-side step checks).
 */
export function useFormAction(
  action: FormAction,
  beforeSubmit?: (form: HTMLFormElement) => boolean,
) {
  const [state, dispatch, pending] = useActionState(action, IDLE);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    if (beforeSubmit && !beforeSubmit(form)) return;
    const fd = new FormData(form);
    startTransition(() => dispatch(fd));
  }

  return { state, pending, onSubmit };
}
