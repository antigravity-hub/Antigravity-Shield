import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json";
import fs from "fs";
import path from "path";
import os from "os";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

function getGuiConfigPath() {
  const custom = process.env.ANTIGRAVITY_SHIELD_DATA_DIR || process.env.SHIELD_DATA_DIR || process.env.ABV_DATA_DIR;
  if (custom && fs.existsSync(custom)) {
    return path.join(custom, "gui_config.json");
  }
  return path.join(os.homedir(), ".antigravity_shield", "gui_config.json");
}

function isObject(item: any): boolean {
  return item && typeof item === "object" && !Array.isArray(item);
}

function deepMerge(target: any, source: any): any {
  if (!isObject(target) || !isObject(source)) {
    return source !== undefined ? source : target;
  }
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (isObject(source[key])) {
      if (!(key in target) || !isObject(target[key])) {
        output[key] = source[key];
      } else {
        output[key] = deepMerge(target[key], source[key]);
      }
    } else if (source[key] !== undefined) {
      output[key] = source[key];
    }
  }
  return output;
}

function readGuiConfig(): any {
  try {
    const configPath = getGuiConfigPath();
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch (err) {
    console.error("[dev-server] Failed to read gui_config.json:", err);
  }
  return null;
}

function writeGuiConfig(incomingConfig: any): boolean {
  try {
    const configPath = getGuiConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const existing = readGuiConfig() || {};
    const merged = deepMerge(existing, incomingConfig);
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("[dev-server] Failed to write gui_config.json:", err);
    return false;
  }
}

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

        if (req.url === "/__dev/install-skill" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => { body += chunk; });
          req.on("end", async () => {
            try {
              const skill = JSON.parse(body);
              const { installLocalSkill } = await import("./scripts/devSkillsScanner.mjs");
              const targetFile = installLocalSkill(skill);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, path: targetFile }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        if (req.url === "/__dev/uninstall-skill" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => { body += chunk; });
          req.on("end", async () => {
            try {
              const { skillId } = JSON.parse(body);
              const { uninstallLocalSkill } = await import("./scripts/devSkillsScanner.mjs");
              uninstallLocalSkill(skillId);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        if (req.url === "/__dev/toggle-skill" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => { body += chunk; });
          req.on("end", async () => {
            try {
              const { skillId, enabled } = JSON.parse(body);
              const { toggleLocalSkill } = await import("./scripts/devSkillsScanner.mjs");
              toggleLocalSkill(skillId, enabled);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // Direct SSoT Configuration handling for Browser Dev Mode
        if (req.url?.startsWith("/api/config")) {
          if (req.method === "GET") {
            const diskConfig = readGuiConfig();
            if (diskConfig) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(diskConfig));
              return;
            }
          } else if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk: any) => {
              body += chunk;
            });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body);
                const configToSave = parsed.config || parsed;
                writeGuiConfig(configToSave);

                // Also forward to Axum backend with bearer auth if running
                const apiKey = configToSave?.proxy?.api_key || "sk-88d0a0c262754391bf7c1cc589d10cb2";
                fetch("http://127.0.0.1:8045/api/config", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "x-api-key": apiKey
                  },
                  body: JSON.stringify(parsed)
                }).catch(() => {});

                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }
        }

        if (req.url?.startsWith("/api/proxy/status") && req.method === "GET") {
          try {
            const diskConfig = readGuiConfig();
            const apiKey = diskConfig?.proxy?.api_key || "sk-88d0a0c262754391bf7c1cc589d10cb2";
            const resp = await fetch("http://127.0.0.1:8045/api/proxy/status", {
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "x-api-key": apiKey
              },
              signal: AbortSignal.timeout(1000)
            });
            if (resp.ok) {
              const data = await resp.json();
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(data));
              return;
            }
          } catch {}

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            running: true,
            port: 8045,
            base_url: "http://127.0.0.1:8045",
            active_accounts: 10
          }));
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
    host: "0.0.0.0",
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri` and temporary export dirs
      ignored: ["**/src-tauri/**", "**/hub-export/**"],
    },
    proxy: {
      "/api/": {
        target: "http://127.0.0.1:8045",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            const config = readGuiConfig();
            const apiKey = config?.proxy?.api_key || "sk-88d0a0c262754391bf7c1cc589d10cb2";
            if (!proxyReq.getHeader("Authorization")) {
              proxyReq.setHeader("Authorization", `Bearer ${apiKey}`);
            }
            if (!proxyReq.getHeader("x-api-key")) {
              proxyReq.setHeader("x-api-key", apiKey);
            }
          });
        },
      },
    },
  },
}));
