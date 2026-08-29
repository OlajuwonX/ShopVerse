import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: false,
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { height: 900, width: 1440 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { height: 844, width: 390 } },
    },
  ],
  reporter: process.env.CI ? "line" : [["list"]],
  retries: 0,
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm start --port ${PORT}`,
    env: { APP_ORIGIN: BASE_URL },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    url: BASE_URL,
  },
  workers: 1,
});
