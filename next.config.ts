import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const CLOUDINARY = "https://res.cloudinary.com";

/**
 * `script-src` deliberately carries `'unsafe-inline'`.
 *
 * Next emits ~35 inline `<script>` tags per page for the RSC flight payload. Allowing
 * them requires either `'unsafe-inline'` or a per-request nonce, and the Next docs are
 * explicit that nonces work only on **dynamically rendered** pages: "Static pages are
 * generated at build time, when no request or response headers exist—so no nonce can be
 * injected."
 *
 * This app is deliberately static/ISR on `/`, `/cart`, `/wishlist`, `/checkout` and every
 * catalogue route. Adopting nonces means forcing all of them dynamic, which would undo the
 * caching work of Stages 15–23 and contradict Stage 26 Decision 1. That trade is a Stage 39
 * decision, tracked as H-3 in `.claude/AUDIT-REMEDIATION.md`.
 *
 * What the policy below still buys, even with `'unsafe-inline'`:
 * external script loading is blocked, and the two channels an injected script would use to
 * get data out — `connect-src` (fetch/XHR/beacon) and `form-action` (posting a forged form)
 * — are both restricted to this origin.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'" + (isProduction ? "" : " 'unsafe-eval'"),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${CLOUDINARY}`,
  `media-src 'self' ${CLOUDINARY}`,
  "font-src 'self' data:",
  `connect-src 'self' ${CLOUDINARY}${isProduction ? "" : " ws: wss:"}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  // Only ever sent over HTTPS. Emitting it in development would pin localhost to https
  // in the browser's HSTS store and make the dev server unreachable.
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
