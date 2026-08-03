import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: "site",
  base: "/eRAW/",
  server: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
  build: {
    outDir: "../dist-site",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./site/index.html", import.meta.url)),
        en: fileURLToPath(new URL("./site/en/index.html", import.meta.url)),
      },
    },
  },
});
