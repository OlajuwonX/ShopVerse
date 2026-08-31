import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const root = resolve(import.meta.dirname);

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^server-only$/,
        replacement: resolve(root, "tests/stubs/server-only.ts"),
      },
      { find: /^@\/(.*)$/, replacement: resolve(root, "$1") },
    ],
  },
  test: {
    environment: "node",
    fileParallelism: false,
    globals: false,
    // Integration tests run against a remote Neon instance whose latency varies widely;
    // order creation alone has been measured between 2s and 12s. These bounds are about
    // tolerating infrastructure, not about slow assertions.
    hookTimeout: 90_000,
    exclude: ["tests/e2e/**"],
    include: ["tests/**/*.test.ts"],
    retry: 2,
    setupFiles: ["tests/setup/env.ts"],
    testTimeout: 90_000,
  },
});
