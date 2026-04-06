import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import {
  createRuntimeLogDevFileStore,
  createRuntimeLogDevMiddleware,
  shouldEnableRuntimeLogDevServer
} from "./src/runtime-log/runtime-log-dev-server";

const release = process.env.TWIST_RELEASE === "1";

export default defineConfig(({ command, mode }) => {
  const enableRuntimeLogDevServer = shouldEnableRuntimeLogDevServer({
    command,
    mode,
    isRelease: release
  });
  const runtimeLogPlugin: Plugin | null = enableRuntimeLogDevServer
    ? {
        name: "twist-runtime-log-dev-server",
        configureServer(server: ViteDevServer) {
          const store = createRuntimeLogDevFileStore({
            rootDir: process.cwd()
          });
          server.middlewares.use(createRuntimeLogDevMiddleware(store));
        }
      }
    : null;

  return {
    define: {
      __TWIST_RUNTIME_LOG_DEV_SERVER__: JSON.stringify(enableRuntimeLogDevServer)
    },
    server: {
      host: "0.0.0.0",
      port: 5173
    },
    test: {
      globals: true
    },
    plugins: [...(runtimeLogPlugin ? [runtimeLogPlugin] : []), ...(release ? [viteSingleFile()] : [])],
    ...(release
      ? {
          build: {
            outDir: "release",
            emptyOutDir: true
          }
        }
      : {})
  };
});
