import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (!normalized.includes("/node_modules/")) return undefined;

          if (
            normalized.includes("/node_modules/react/") ||
            normalized.includes("/node_modules/react-dom/") ||
            normalized.includes("/node_modules/react-router-dom/") ||
            normalized.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }

          if (normalized.includes("/node_modules/@supabase/")) return "supabase-vendor";
          if (normalized.includes("/node_modules/lucide-react/")) return "icons-vendor";
          if (
            normalized.includes("/node_modules/recharts/") ||
            normalized.includes("/node_modules/d3-") ||
            normalized.includes("/node_modules/victory-vendor/")
          ) {
            return "charts-vendor";
          }

          return undefined;
        },
      },
    },
  },
});
