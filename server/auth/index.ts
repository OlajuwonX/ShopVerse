export {
  assertCanGrantPermissions,
  canGrantPermissions,
  getCurrentStaffActor,
  hasAnyPermission,
  hasEveryPermission,
  hasPermission,
  isPermissionCode,
  PermissionDeniedError,
  requireAnyPermission,
  requirePermission,
  resolveStaffPermissions,
} from "@/server/auth/permissions";
export type { StaffActor } from "@/server/auth/permissions";
export { authenticateCustomer, authenticateStaff } from "@/server/auth/authenticate";
export {
  clearSessionCookie,
  readSessionCookie,
  writeSessionCookie,
} from "@/server/auth/cookies";
export { hashPassword, normalizeEmail, verifyPassword } from "@/server/auth/passwords";
export { checkRateLimit, clearRateLimit } from "@/server/auth/rate-limit";
export {
  createSession,
  getCurrentSession,
  requireCustomerSession,
  requireStaffSession,
  revokeSession,
} from "@/server/auth/sessions";
export { createOpaqueToken, hashToken, safeCompare } from "@/server/auth/tokens";
export type {
  AuthenticatedSession,
  AuthResult,
  SessionAudience,
} from "@/server/auth/types";
