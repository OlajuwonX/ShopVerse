export type SessionAudience = "customer" | "staff";

export type AuthenticatedSession = {
  audience: SessionAudience;
  expiresAt: Date;
  idleExpiresAt: Date | null;
  sessionId: string;
  staffAccountId: string | null;
  userId: string;
};

export type AuthResult =
  | { ok: true; session: AuthenticatedSession }
  | { ok: false; reason: "invalid_credentials" | "rate_limited" };
