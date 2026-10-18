import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

import { replayVersions } from "./tooling/replay-versions";

export default defineConfig({
  define: { __REPLAY_ENGINE_VERSIONS__: JSON.stringify(replayVersions) },
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
