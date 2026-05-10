import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Mirror tsconfig.json's "@/*" → "./*" path mapping so Vitest can resolve
  // imports the same way Next does at build time.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // server-only throws on import from a Client Component context. The
      // protection is a build-time check on the bundler side, irrelevant
      // under Vitest. Map to an empty stub so tests can import server
      // modules normally.
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.spec.{ts,tsx}"],
    environment: "node",
    testTimeout: 20000,
  },
});
