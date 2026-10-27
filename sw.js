/* ============================================================
   Service Worker — La Prière du Prophète ﷺ (site statique brut)
   - Pages (HTML)        : réseau d'abord → cache en secours
   - Fichiers locaux     : cache d'abord → réseau pour remplir
   - Hors ligne          : tout le site reste utilisable
   - Exclus (réseau seul): chemins login / auth / OAuth / tokens
   ============================================================ */

const VERSION = 'v3-pwa-2026-10-27';
const PAGES_CACHE = 'pages-' + VERSION;
const FILES_CACHE = 'files-' + VERSION;
const OFFLINE_FALLBACK = './index.html';

/* Ressources essentielles à mettre en cache à l'installation */
const CORE = [
  './',
  './index.html',
  './quiz.html',
  './guide.html',
  './stage-1-qibla.html',
  './stage-2-takbir.html',
  './stage-3-intention.html',
  './stage-4-fatiha.html',
  './stage-5-roukou.html',
  './stage-6-relever.html',
  './stage-7-soujoud.html',
  './stage-8-assis.html',
  './stage-9-tashahhud.html',
  './stage-10-salam.html',
  './style.css',
  './script.js',
  './install-banner.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './images/stage-1-qibla.jpg',
  './images/stage-2-takbir.jpg',
  './images/stage-3-debout.jpg',
  './images/stage-5-inclinaison.jpg',
  './images/stage-7-prosternation.jpg',
  './images/stage-8-assis.jpg',
  './images/stage-9-tashahoud.jpg',
  './images/stage-10-salam.jpg',
  './Description_priere_et_adhkar_francais.pdf'
];

/* Chemins jamais interceptés : login, auth, OAuth, callbacks, tokens */
const EXCLUDE_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/signup/i,
  /\/logout/i,
  /\/auth/i,
  /\/oauth/i,
  /\/callback/i,
  /\/connect\//i,
  /[?&](code|token|access_token|id_token|refresh_token|state|session|nonce)=/i
];

function isExcluded(url) {
  const hay = url.pathname + url.search;
  return EXCLUDE_PATTERNS.some((re) => re.test(hay));
}

/* ---------- Installation : pré-cache de tout le site ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(FILES_CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

/* ---------- Activation : purge des anciennes versions ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== PAGES_CACHE && k !== FILES_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------- Requêtes ---------- */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return; // POST/PUT... : navigateur seul

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  if (url.origin !== self.location.origin) return; // cross-origin : navigateur seul
  if (isExcluded(url)) return; // login / OAuth : réseau seul, jamais de cache

  const isPage =
    request.mode === 'navigate' || request.destination === 'document';

  if (isPage) {
    /* ---- Pages HTML : RÉSEAU d'abord ---- */
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_FALLBACK))
        )
    );
  } else {
    /* ---- Fichiers locaux (css, js, images, icons, pdf) : CACHE d'abord ---- */
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok && response.type === 'same-origin') {
            const copy = response.clone();
            caches.open(FILES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
