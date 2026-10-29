import { defineConfig } from "vitest/config";

// The unit tier (SF-ADR-012 stage 7): adapter conformance, fake-world fidelity, the build tool.
export default defineConfig({
  test: {
    include: ["tools/**/*.test.ts", "src/**/*.unit.test.ts"],
    server: { deps: { inline: [/@mmmnt\/feat-/] } },
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts", "src/features/**/*.ts", "tools/feat-adapters/**/*.ts", "tools/build/**/*.ts"],
      exclude: ["**/*.test.ts"],
      reportsDirectory: "coverage/unit",
      reporter: ["json", "text-summary"],
    },
  },
});
