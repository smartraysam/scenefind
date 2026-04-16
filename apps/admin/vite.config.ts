import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_PROXY_TARGET || "http://localhost:8787";

  return {
    server: {
      host: true,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
