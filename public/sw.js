const SHELL_CACHE = "govcare-shell-v4";
const ASSET_CACHE = "govcare-assets-v4";
const SHELL_ASSETS = ["/", "/index.html", "/manifest.webmanifest", "/ministry-health-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, ASSET_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isPrivateNetworkRequest(url) {
  return url.hostname.includes("googleapis.com")
    || url.hostname.includes("firebaseio.com")
    || url.hostname.includes("cloudfunctions.net")
    || url.pathname.includes("/__/auth/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isPrivateNetworkRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(SHELL_CACHE).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  const cacheableAsset = url.pathname.startsWith("/assets/")
    || request.destination === "image"
    || request.destination === "font"
    || url.pathname === "/manifest.webmanifest";
  if (cacheableAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            void caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      }),
    );
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "govcare-sync-actions") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => clients.forEach((client) => client.postMessage({ type: "GOVCARE_SYNC_REQUESTED" }))),
  );
});
