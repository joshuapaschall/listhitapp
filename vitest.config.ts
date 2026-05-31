import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/helpers/empty-module.ts"),
    },
  },
  esbuild: { jsx: "automatic" },
  test: {
    globals: true,
    setupFiles: ["tests/setup.ts"],
    environmentMatchGlobs: [
      ["tests/**/*.test.tsx", "jsdom"],
      ["tests/**/*.test.ts", "node"],
    ],
    css: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    isolate: true,
    server: {
      deps: {
        inline: [
          "@noble/ed25519",
          "@noble/curves",
          "@noble/hashes",
          "nanoid",
        ],
      },
    },
  },
})
