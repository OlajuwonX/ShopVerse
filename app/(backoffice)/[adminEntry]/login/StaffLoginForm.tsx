"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signInStaff } from "@/features/authentication/actions/staff-session";
import {
  FORM_RENDERED_AT_FIELD_NAME,
  HONEYPOT_FIELD_NAME,
  type StaffLoginState,
} from "@/features/authentication/schemas/staff-login";

const initialState: StaffLoginState = { error: null };

export function StaffLoginForm() {
  const [state, formAction, isPending] = useActionState(signInStaff, initialState);
  // Stamped once during the server render, so the value ships in the HTML and
  // survives re-renders. It is still a client-supplied field: the server treats
  // it as a weak automation signal, never as proof of anything.
  const [renderedAt] = useState(() => Date.now());

  return (
    <form action={formAction} className="grid gap-4">
      {/*
        Honeypot: hidden from assistive technology and removed from the tab
        order, so a human never encounters it. Validated server-side, and never
        the only anti-bot control (MASTER §68).
      */}
      <div aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0">
        <label htmlFor={HONEYPOT_FIELD_NAME}>Company website</label>
        <input
          autoComplete="off"
          defaultValue=""
          id={HONEYPOT_FIELD_NAME}
          name={HONEYPOT_FIELD_NAME}
          tabIndex={-1}
          type="text"
        />
      </div>

      <input
        name={FORM_RENDERED_AT_FIELD_NAME}
        type="hidden"
        value={String(renderedAt)}
      />

      <Input
        autoComplete="username"
        label="Work email"
        name="email"
        required
        type="email"
      />

      <Input
        autoComplete="current-password"
        label="Password"
        name="password"
        required
        type="password"
      />

      {/*
        Announced politely so screen reader users hear the failure without the
        message stealing focus mid-correction.
      */}
      <p aria-live="polite" className="min-h-5 text-body-sm text-danger" role="status">
        {state.error}
      </p>

      <Button isLoading={isPending} size="lg" type="submit">
        Sign in
      </Button>
    </form>
  );
}
