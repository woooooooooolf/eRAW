import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

export default defineConfig({
  root: "site",
  base: "/eRAW/",
  server: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
  define: {
    __ERAW_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    outDir: "../dist-site",
    emptyOutDir: true,
  },
});
