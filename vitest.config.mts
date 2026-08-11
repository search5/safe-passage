import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // 'obsidian' ships types only (no runtime module) — provide a minimal stand-in so
      // source files that import runtime helpers like normalizePath can load under vitest.
      obsidian: fileURLToPath(new URL("./test/__mocks__/obsidian.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
