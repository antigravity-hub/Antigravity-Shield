import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

function devLocalSkillsPlugin() {
  return {
    name: "dev-local-skills-plugin",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === "/__dev/local-skills") {
          try {
            const { scanLocalSkills } = await import("./scripts/devSkillsScanner.mjs");
            const skills = scanLocalSkills();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(skills));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        if (req.url?.startsWith("/__dev/read-skill?")) {
          try {
            const url = new URL(req.url, "http://localhost");
            const id = url.searchParams.get("id") || "";
            const { readLocalSkillContent } = await import("./scripts/devSkillsScanner.mjs");
            const content = readLocalSkillContent(id);
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(content);
          } catch (e: any) {
            res.statusCode = 500;
            res.end("");
          }
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), devLocalSkillsPlugin()],
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
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
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/api/": {
        target: "http://127.0.0.1:8046",
        changeOrigin: true,
      },
    },
  },
}));
