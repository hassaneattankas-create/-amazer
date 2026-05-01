import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execSync, spawn } from "node:child_process";

function tryGitShortHead(cwd) {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8", cwd }).trim();
  } catch {
    return "";
  }
}

function loadEnvMobileFile() {
  const p = join(process.cwd(), ".env.mobile");
  if (!existsSync(p)) {
    return;
  }
  const text = readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvMobileFile();

const repoRootGuess = join(process.cwd(), "..");
const gitShort = tryGitShortHead(process.cwd()) || tryGitShortHead(repoRootGuess);
const stamp = `${new Date().toISOString().slice(0, 19)}Z${gitShort ? ` ${gitShort}` : ""}`;
process.env.NEXT_PUBLIC_BUILD_STAMP = stamp;

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
  "restaurant/order/pay/[id]",
  "restaurant/order/receipt/[id]",
];
const DEFAULT_MOBILE_BACKEND_ORIGIN = "https://amazer-api.onrender.com";
const DEFAULT_MOBILE_SITE_URL = "https://amazer.store";

const requestedMobileBackendOrigin =
  process.env.MOBILE_BACKEND_ORIGIN?.trim() ||
  process.env.NEXT_PUBLIC_MOBILE_BACKEND_ORIGIN?.trim() ||
  DEFAULT_MOBILE_BACKEND_ORIGIN;

// Origine API (images, rewrites serveur) — l’APK consomme surtout le proxy du site via NEXT_PUBLIC_MOBILE_SITE_URL.
process.env.NEXT_PUBLIC_BACKEND_ORIGIN = requestedMobileBackendOrigin;
delete process.env.NEXT_PUBLIC_API_URL;

// Par défaut : même chaîne que le site web (proxy /backend-api + routes Next), UI packagée dans l’APK (pas de WebView distante).
const mobileSite =
  process.env.NEXT_PUBLIC_MOBILE_SITE_URL?.trim() || DEFAULT_MOBILE_SITE_URL;
process.env.NEXT_PUBLIC_MOBILE_SITE_URL = mobileSite;

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
  rmSync(nextBuildDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
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
  console.log(`[mobile-build] Dossier frontend: ${process.cwd()}`);
  console.log(`[mobile-build] Empreinte build (dans l'APK): ${stamp}`);
  console.log(`[mobile-build] Using backend origin: ${process.env.NEXT_PUBLIC_BACKEND_ORIGIN}`);
  console.log(`[mobile-build] Mobile site (API proxy): ${process.env.NEXT_PUBLIC_MOBILE_SITE_URL}`);
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
