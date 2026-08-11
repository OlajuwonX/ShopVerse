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

  const [renderedAt] = useState(() => Date.now());

  return (
    <form action={formAction} className="grid gap-4">
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

      <p aria-live="polite" className="min-h-5 text-body-sm text-danger" role="status">
        {state.error}
      </p>

      <Button isLoading={isPending} size="lg" type="submit">
        Sign in
      </Button>
    </form>
  );
}
