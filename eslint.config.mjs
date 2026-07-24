import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  { ignores: ["main.js", "node_modules/**", "esbuild.config.mjs", "scripts/**"] },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      // 데스크톱 전용(Platform.isDesktop 가드) 코드에서만 쓰는 Node 전역(Buffer 등)
      globals: { ...globals.node },
    },
  },
]);
