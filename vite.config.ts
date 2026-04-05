import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const release = process.env.TWIST_RELEASE === "1";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  test: {
    globals: true
  },
  ...(release
    ? {
        plugins: [viteSingleFile()],
        build: {
          outDir: "release",
          emptyOutDir: true
        }
      }
    : {})
});
