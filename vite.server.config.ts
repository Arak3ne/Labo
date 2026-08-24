import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    ssr: "src/incubator/core/server/vercelApiEntry.ts",
    outDir: "dist-server",
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    target: "node20",
    rollupOptions: {
      external: ["ws"],
      output: {
        format: "es",
        entryFileNames: "apiEntry.js",
      },
    },
  },
});
