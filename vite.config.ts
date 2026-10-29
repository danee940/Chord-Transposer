import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = import.meta.dirname;

export default defineConfig({
  root: "src/js",
  build: {
    manifest: "manifest.json",
    outDir: resolve(rootDir, "src/static/js"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(rootDir, "src/js/main.ts"),
        landing: resolve(rootDir, "src/js/landing.ts"),
      },
      output: {
        entryFileNames: "[name].[hash].js",
        chunkFileNames: "[name].[hash].js",
        assetFileNames: "[name].[hash][extname]",
      },
    },
  },
  test: {
    root: rootDir,
    environment: "jsdom",
    include: ["src/js/**/*.test.{js,ts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/js/**/*.ts"],
      exclude: ["src/js/**/*.test.ts"],
      thresholds: {
        statements: 99,
        branches: 98,
        functions: 100,
        lines: 99,
      },
    },
  },
});
