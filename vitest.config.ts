import { defineConfig } from "vitest/config";

// Standalone on purpose: vitest would otherwise load vite.config.ts, whose Cloudflare Workers
// plugin rejects the Node externals vitest needs and fails at startup. Nothing here needs the app's
// build pipeline — these are unit tests over pure modules.
// Component tests can opt into the DOM per-file with `// @vitest-environment jsdom`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
