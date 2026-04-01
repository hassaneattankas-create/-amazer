import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const appDir = join(process.cwd(), "src", "app");
const apiDir = join(appDir, "api");
const disabledApiDir = join(appDir, "__api_disabled_for_mobile");

if (!process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() && !process.env.NEXT_PUBLIC_API_URL?.trim()) {
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN = "https://amazer-api.onrender.com";
}

if (existsSync(disabledApiDir)) {
  throw new Error("Temporary mobile API folder already exists. Restore it before running build:mobile.");
}

const shouldDisableApiRoutes = existsSync(apiDir);
if (shouldDisableApiRoutes) {
  cpSync(apiDir, disabledApiDir, { recursive: true, force: true });
  rmSync(apiDir, { recursive: true, force: true });
}

function restoreApiRoutes() {
  if (!shouldDisableApiRoutes || !existsSync(disabledApiDir)) {
    return;
  }
  if (existsSync(apiDir)) {
    rmSync(apiDir, { recursive: true, force: true });
  }
  cpSync(disabledApiDir, apiDir, { recursive: true, force: true });
  rmSync(disabledApiDir, { recursive: true, force: true });
}

try {
  await new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(command, ["next", "build", "--webpack"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Mobile build failed with exit code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
} finally {
  restoreApiRoutes();
}
