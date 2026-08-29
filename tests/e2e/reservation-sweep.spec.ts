import { expect, test } from "@playwright/test";

const SWEEP = "/api/internal/reservations/sweep";

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
});
