import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5300,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 900,
    modulePreload: {
      resolveDependencies: () => [],
    },
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("dompurify")) return "vendor-sanitize";
          if (id.includes("jspdf") || id.includes("html2canvas")) return "vendor-documents";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) return "vendor-react";
          return "vendor";
        },
      },
    },
  },
})
