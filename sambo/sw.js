// Facultatif : permet d'ouvrir le carnet hors-ligne quand il est hébergé en HTTPS
// (iPhone, écran d'accueil). Le carnet fonctionne sans ce fichier.
// Stratégie : la copie en cache s'affiche tout de suite, et elle est mise à jour
// en arrière-plan quand le réseau est là (la nouvelle version s'affiche au lancement suivant).
const CACHE = 'carnet-sambo-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.add(new URL('carnet-sambo.html', self.location).href))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('carnet-sambo-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// La page envoie sa propre adresse, pour être mise en cache même si le fichier a été renommé.
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'mettre-en-cache' || typeof data.url !== 'string') return;
  const url = new URL(data.url);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(url.href)).catch(() => {}));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const network = fetch(req)
    .then(async res => {
      if (res.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);
  event.waitUntil(network);
  event.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true })
      .then(cached => cached || network.then(res => res || Response.error()))
  );
});
