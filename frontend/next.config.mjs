/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "true";

const csp = [
  "default-src 'self'",
  // Next.js injects runtime/inline scripts; keep CSP strict but compatible with hydration.
  isProd ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  isProd
    ? "connect-src 'self' https://amazer.vercel.app https://www.amazer.vercel.app https://amazer-api.onrender.com"
    : "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 ws: wss:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  output: isStaticExport ? "export" : undefined,
  trailingSlash: isStaticExport,
  images: {
    // Keep direct image loading in production to avoid optimizer/domain issues on external vendor URLs.
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    deviceSizes: [360, 414, 640, 768, 1024, 1280],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  async headers() {
    // In local dev, avoid breaking Next runtime/hydration with overly strict CSP.
    if (!isProd) {
      return [];
    }

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
