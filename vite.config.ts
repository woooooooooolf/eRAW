import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;
const sourceDateEpoch = Number(process.env.SOURCE_DATE_EPOCH);
const buildDate = Number.isFinite(sourceDateEpoch) && sourceDateEpoch > 0
  ? new Date(sourceDateEpoch * 1000)
  : new Date();

export default defineConfig({
  clearScreen: false,
  define: {
    __ERAW_BUILD_TIME__: JSON.stringify(buildDate.toISOString()),
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
