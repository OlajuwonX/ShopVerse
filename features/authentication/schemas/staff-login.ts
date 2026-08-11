import { z } from "zod";

import { loginCredentialsSchema } from "@/features/authentication/schemas/credentials";

export const MIN_FORM_FILL_MS = 1_500;

export const HONEYPOT_FIELD_NAME = "company_website";
export const FORM_RENDERED_AT_FIELD_NAME = "rendered_at";

export const staffLoginSchema = loginCredentialsSchema.extend({
  [HONEYPOT_FIELD_NAME]: z
    .string()
    .max(0, { message: "Unexpected value" })
    .optional()
    .default(""),
  [FORM_RENDERED_AT_FIELD_NAME]: z.coerce.number().int().positive(),
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

export type StaffLoginState = {
  error: string | null;
};
