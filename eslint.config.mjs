import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "node_modules/**"]),
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["server/cache/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/cache",
              message:
                "Read through server/cache/* and invalidate through server/cache/revalidate.ts. Caching and invalidation stay behind one boundary.",
            },
          ],
        },
      ],
    },
  },
]);
