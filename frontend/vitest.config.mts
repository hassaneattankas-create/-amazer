import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    restoreMocks: true,
  },
  resolve: {
    // fileURLToPath : gere les espaces du chemin (« amazer savegarde ») que URL.pathname encode en %20.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
