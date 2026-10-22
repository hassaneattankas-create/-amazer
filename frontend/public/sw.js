// Service worker minimal d'AMAZER : il rend le site installable (« Installer l'application »)
// sans rien garder en mémoire. Chaque page et chaque donnée viennent toujours du réseau :
// pas de vieille version affichée après une mise à jour.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Supprime les anciens caches (versions précédentes du service worker).
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Gestionnaire réseau minimal, demandé par certains navigateurs pour proposer l'installation :
// seulement l'ouverture des pages. Images, données et paiements passent directement, sans détour.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request));
});
