import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const appDir = join(process.cwd(), "src", "app");
const apiDir = join(appDir, "api");
const disabledApiDir = join(appDir, "__api_disabled_for_mobile");
const nextBuildDir = join(process.cwd(), ".next");
const disabledDynamicRoutesDir = join(appDir, "__dynamic_routes_disabled_for_mobile");
const dynamicRouteDirs = [
  "category/[slug]",
  "product/[id]",
  "shop/[vendorId]",
  "order/pay/[id]",
  "order/receipt/[id]",
  "order/success/[id]",
];
const defaultMobileBackendOrigin = "https://amazer-api.onrender.com";
const requestedMobileBackendOrigin =
  process.env.MOBILE_BACKEND_ORIGIN?.trim() ||
  process.env.NEXT_PUBLIC_MOBILE_BACKEND_ORIGIN?.trim() ||
  defaultMobileBackendOrigin;

// Mobile bundled builds must always target a reachable absolute backend origin.
// We intentionally override local web dev values such as /backend-api or localhost.
process.env.NEXT_PUBLIC_BACKEND_ORIGIN = requestedMobileBackendOrigin;
delete process.env.NEXT_PUBLIC_API_URL;

if (existsSync(disabledApiDir)) {
  throw new Error("Temporary mobile API folder already exists. Restore it before running build:mobile.");
}
if (existsSync(disabledDynamicRoutesDir)) {
  throw new Error(
    "Temporary disabled dynamic routes folder already exists. Restore it before running build:mobile."
  );
}

const shouldDisableApiRoutes = existsSync(apiDir);
if (shouldDisableApiRoutes) {
  cpSync(apiDir, disabledApiDir, { recursive: true, force: true });
  rmSync(apiDir, { recursive: true, force: true });
}

const routesToDisable = dynamicRouteDirs.filter((relativePath) => existsSync(join(appDir, relativePath)));
for (const relativePath of routesToDisable) {
  const sourceDir = join(appDir, relativePath);
  const backupDir = join(disabledDynamicRoutesDir, relativePath);
  mkdirSync(join(backupDir, ".."), { recursive: true });
  cpSync(sourceDir, backupDir, { recursive: true, force: true });
  rmSync(sourceDir, { recursive: true, force: true });
}

if (existsSync(nextBuildDir)) {
  rmSync(nextBuildDir, { recursive: true, force: true });
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

function restoreDynamicRoutes() {
  if (!routesToDisable.length || !existsSync(disabledDynamicRoutesDir)) {
    return;
  }
  for (const relativePath of routesToDisable) {
    const sourceDir = join(disabledDynamicRoutesDir, relativePath);
    const targetDir = join(appDir, relativePath);
    if (!existsSync(sourceDir)) {
      continue;
    }
    cpSync(sourceDir, targetDir, { recursive: true, force: true });
  }
  rmSync(disabledDynamicRoutesDir, { recursive: true, force: true });
}

try {
  console.log(`[mobile-build] Using backend origin: ${process.env.NEXT_PUBLIC_BACKEND_ORIGIN}`);
  await new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "cmd.exe" : "npx";
    const args =
      process.platform === "win32"
        ? ["/d", "/s", "/c", "npx next build --webpack"]
        : ["next", "build", "--webpack"];
    const child = spawn(command, args, {
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
  restoreDynamicRoutes();
  restoreApiRoutes();
}
