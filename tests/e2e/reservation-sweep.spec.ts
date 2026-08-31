import { expect, test } from "@playwright/test";

import { readEnvValue } from "./env";

const SWEEP = "/api/internal/reservations/sweep";

const cronSecret = readEnvValue("CRON_SECRET");

test.describe("reservation sweep endpoint", () => {
  test("is not reachable without the shared secret", async ({ request }) => {
    for (const headers of [
      undefined,
      { authorization: "Bearer wrong-secret-value-that-is-long-enough" },
      { authorization: "Basic abc" },
    ]) {
      const response = await request.get(SWEEP, headers ? { headers } : {});

      expect(response.status(), JSON.stringify(headers)).toBe(404);
    }
  });

  test("does not reveal itself in the 404 body", async ({ request }) => {
    const response = await request.get(SWEEP);
    const body = await response.text();

    expect(body).not.toMatch(/reservation|sweep|inventory|cron/i);
  });

  test("rejects unauthenticated POST as well as GET", async ({ request }) => {
    const response = await request.post(SWEEP, { data: {} });

    expect(response.status()).toBe(404);
  });

  test("is never cached", async ({ request }) => {
    const response = await request.get(SWEEP);

    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  /**
   * The four cases above all assert 404, and with no `CRON_SECRET` configured they all
   * pass through the `not_configured` branch before the bearer check runs at all — so the
   * suite stayed green whether the authorisation logic worked or was missing entirely.
   * This is the case that fails when the route is switched off, which is the state the
   * Stage 1-27 audit found it in.
   */
  test.describe("with the secret configured", () => {
    test.skip(
      cronSecret === null,
      "CRON_SECRET is not set, so the route is intentionally 404 for everyone",
    );

    test("an authorised call succeeds and reports what it released", async ({
      request,
    }) => {
      const response = await request.post(SWEEP, {
        headers: { authorization: `Bearer ${cronSecret}` },
      });

      expect(response.status()).toBe(200);

      const body = (await response.json()) as unknown;

      expect(body).toEqual({
        released: expect.any(Number),
        skippedInFlight: expect.any(Number),
      });
    });

    test("GET is authorised the same way POST is", async ({ request }) => {
      const response = await request.get(SWEEP, {
        headers: { authorization: `Bearer ${cronSecret}` },
      });

      expect(response.status()).toBe(200);
    });

    test("a secret of the right length but the wrong value is still refused", async ({
      request,
    }) => {
      const wrong = "z".repeat(cronSecret?.length ?? 32);

      const response = await request.get(SWEEP, {
        headers: { authorization: `Bearer ${wrong}` },
      });

      expect(response.status()).toBe(404);
    });

    test("the authorised response is never cached", async ({ request }) => {
      const response = await request.get(SWEEP, {
        headers: { authorization: `Bearer ${cronSecret}` },
      });

      expect(response.headers()["cache-control"]).toContain("no-store");
    });
  });
});
