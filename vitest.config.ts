import { defineConfig } from "vitest/config";

// Read by `feat run --coverage` (SF-ADR-012 stages 6 and 8). The runner owns test selection; this
// file only scopes coverage to the code the specs exercise: the domain core and the handlers.
export default defineConfig({
  test: {
    // Inline the Feature runtime so its dynamic imports of handlers and adapters go through Vite's
    // transform. Natively type-stripped TypeScript keeps raw offsets that the v8 provider would
    // remap through esbuild's source map, attributing coverage to the wrong lines.
    server: { deps: { inline: [/@mmmnt\/feat-/] } },
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts", "src/features/**/*.ts"],
      exclude: ["**/*.test.ts"],
      reportsDirectory: "coverage/spec",
      reporter: ["json", "text-summary"],
    },
  },
});
