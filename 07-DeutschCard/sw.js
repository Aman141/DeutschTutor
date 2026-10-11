// Service worker: lets the installed app open with no network.
//
// The app shell is fetched network-first: online you always get the version just
// deployed (no "refresh twice" after an update), offline — or when the network
// takes longer than SHELL_TIMEOUT — the last copy from the cache. /api/ is never
// touched here: the deck lives in IndexedDB and syncs through app.js's outbox.
//
// Bump CACHE only when SHELL changes; edits to the files themselves need nothing.
const CACHE = 'deutschcard-shell-v1';
const SHELL = [
  './', 'style.css', 'ops.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/favicon-32.png',
];
const SHELL_TIMEOUT = 2500;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // The app is the page at the scope root. Any other page opened directly (an
  // icon, a JSON file) is left to the browser — cached as './' it would replace
  // the app and the next offline start would show a PNG.
  const root = new URL('./', location.href).pathname;
  if (req.mode === 'navigate' && url.pathname !== root && url.pathname !== root + 'index.html') return;
  const key = req.mode === 'navigate' ? new URL('./', location.href).href : url.href.split('#')[0];
  event.respondWith(networkFirst(req, key));
});

async function networkFirst(req, key) {
  const cache = await caches.open(CACHE);
  const network = fetch(req).then(res => {
    if (res.ok && !res.redirected) cache.put(key, res.clone());
    return res;
  });
  network.catch(() => {});    // a late failure after the cache answered is fine
  const timeout = new Promise(resolve => setTimeout(resolve, SHELL_TIMEOUT));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch (e) { /* offline: fall through to the cache */ }
  const cached = await cache.match(key, { ignoreSearch: true });
  return cached || network;   // nothing cached yet: wait for the network after all
}
