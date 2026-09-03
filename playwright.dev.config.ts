import { defineConfig, devices } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        extraHTTPHeaders: { "x-real-ip": "203.0.113.30" },
        viewport: { height: 900, width: 1440 },
      },
    },
  ],
  reporter: [["list"]],
  retries: 0,
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  workers: 1,
});
