/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "true";

function getBackendOrigin() {
  const explicit = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const raw = explicit || apiUrl || "";
  if (!raw) {
    return "https://amazer-api.onrender.com";
  }
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).origin.replace(/\/$/, "");
  } catch {
    return "https://amazer-api.onrender.com";
  }
}

const backendOrigin = getBackendOrigin();

function buildConnectSrc() {
  const origins = new Set(["'self'"]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (apiUrl) {
    try {
      const u = new URL(apiUrl);
      origins.add(`${u.protocol}//${u.host}`);
    } catch {
      // ignore invalid URL at build time
    }
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      const u = new URL(siteUrl);
      origins.add(`${u.protocol}//${u.host}`);
    } catch {
      // ignore
    }
  }
  const extra = process.env.NEXT_PUBLIC_CSP_CONNECT_EXTRA?.split(",") || [];
  for (const raw of extra) {
    const part = raw.trim();
    if (part) {
      origins.add(part);
    }
  }
  if (isProd) {
    // Héritage : domaines historiques (retirer quand tout est migré vers les variables ci-dessus)
    origins.add("https://amazer.vercel.app");
    origins.add("https://www.amazer.vercel.app");
    origins.add("https://amazerniger.vercel.app");
    origins.add("https://www.amazerniger.vercel.app");
  } else {
    origins.add("http://localhost:8000");
    origins.add("http://127.0.0.1:8000");
    origins.add("ws:");
    origins.add("wss:");
  }
  return Array.from(origins).join(" ");
}

const csp = [
  "default-src 'self'",
  isProd ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${buildConnectSrc()}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  compress: true,
  compiler: {
    removeConsole: isProd ? { exclude: ["error", "warn"] } : false,
  },
  output: isStaticExport ? "export" : undefined,
  trailingSlash: isStaticExport,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  images: {
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    deviceSizes: [360, 414, 640, 768, 1024, 1280],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  async rewrites() {
    if (isStaticExport) {
      return [];
    }
    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
  async headers() {
    if (!isProd) {
      return [];
    }

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
