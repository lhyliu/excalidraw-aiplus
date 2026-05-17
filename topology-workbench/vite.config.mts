import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            /node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/.test(
              id,
            )
          ) {
            return "react-vendor";
          }
          if (/node_modules[\\/]@xyflow[\\/]/.test(id)) {
            return "flow-vendor";
          }
          if (/node_modules[\\/](elkjs|@dagrejs)[\\/]/.test(id)) {
            return "layout-vendor";
          }
          if (
            /node_modules[\\/](html-to-image|papaparse|read-excel-file|fflate)[\\/]/.test(
              id,
            )
          ) {
            return "data-vendor";
          }

          return undefined;
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^react$/,
        replacement: fileURLToPath(
          new URL("./node_modules/react/index.js", import.meta.url),
        ),
      },
      {
        find: /^react\/(.*)$/,
        replacement: fileURLToPath(
          new URL("./node_modules/react/$1", import.meta.url),
        ),
      },
      {
        find: /^react-dom$/,
        replacement: fileURLToPath(
          new URL("./node_modules/react-dom/index.js", import.meta.url),
        ),
      },
      {
        find: /^react-dom\/(.*)$/,
        replacement: fileURLToPath(
          new URL("./node_modules/react-dom/$1", import.meta.url),
        ),
      },
    ],
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
