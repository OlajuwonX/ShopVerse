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
    globals: false,
    hookTimeout: 30_000,
    exclude: ["tests/e2e/**"],
    include: ["tests/**/*.test.ts"],
    retry: 2,
    setupFiles: ["tests/setup/env.ts"],
    testTimeout: 30_000,
  },
});
