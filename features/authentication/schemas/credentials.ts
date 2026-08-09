import { z } from "zod";

export const loginCredentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(256),
});

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
