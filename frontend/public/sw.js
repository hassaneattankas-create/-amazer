const CACHE_NAME = "amazer-v4";
const DATA_CACHE = "amazer-data-v2";
const APP_SHELL = ["/", "/manifest.json", "/favicon.ico"];
const OFFLINE_PRICE_KEYS = [
  "/api/v1/products/search",
  "/api/v1/products/",
  "/api/v1/alerts",
  "/api/v1/home-content",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  const url = new URL(event.request.url);

  // Navigation requests should always prefer fresh network content.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/") || Response.error())
    );
    return;
  }

  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".jpeg") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".ico") ||
      url.pathname.endsWith(".woff2"));

  if (!isStaticAsset) {
    const isPriceOrFavoritesRequest = OFFLINE_PRICE_KEYS.some((key) =>
      url.pathname.includes(key)
    );
    if (!isPriceOrFavoritesRequest) {
      event.respondWith(fetch(event.request));
      return;
    }

    // Network-first for catalog data so newly created products and storefront changes appear quickly.
    event.respondWith(
      caches.open(DATA_CACHE).then((cache) =>
        fetch(event.request)
          .then((response) => {
            if (!response) {
              return response;
            }
            const cacheable = response.status === 200 || response.status === 0;
            if (cacheable) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cache.match(event.request).then((cached) => cached || Response.error()))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match("/"));
    })
  );
});
