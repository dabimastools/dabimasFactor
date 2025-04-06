// cache name, cache files
var CACHE_NAME = 'dabimas-factor-v20250406-01';
var urlsToCache = [
  '/dabimastools.github.io/dabimasFactor/index.html',
  '/dabimastools.github.io/dabimasFactor/json/dabimasFactor.json',
  '/dabimastools.github.io/dabimasFactor/json/brosData.json',
  '/dabimastools.github.io/dabimasFactor/css/style.css',
  '/dabimastools.github.io/dabimasFactor/css/loading.css',
  '/dabimastools.github.io/dabimasFactor/css/materialdesignicons.min.css',
  '/dabimastools.github.io/dabimasFactor/css/materialdesignicons.min.css.map',
  '/dabimastools.github.io/dabimasFactor/css/notosansjapanese.css',
  '/dabimastools.github.io/dabimasFactor/css/vuetify_compact.min.css',
  '/dabimastools.github.io/dabimasFactor/css/vuetify.min.css',
  '/dabimastools.github.io/dabimasFactor/vue/vue.min.js',
  '/dabimastools.github.io/dabimasFactor/vue/vuetify.js',
  '/dabimastools.github.io/dabimasFactor/vue/vuetify.js.map',
  '/dabimastools.github.io/dabimasFactor/fonts/materialdesignicons-webfont.eot',
  '/dabimastools.github.io/dabimasFactor/fonts/materialdesignicons-webfont.ttf',
  '/dabimastools.github.io/dabimasFactor/fonts/materialdesignicons-webfont.woff',
  '/dabimastools.github.io/dabimasFactor/fonts/materialdesignicons-webfont.woff2',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Black.otf',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Black.woff',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Black.woff2',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Bold.otf',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Bold.woff',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Bold.woff2',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-DemiLight.otf',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-DemiLight.woff',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-DemiLight.woff2',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Light.otf',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Light.woff',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Light.woff2',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Medium.otf',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Medium.woff',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Medium.woff2',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Regular.otf',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Regular.woff',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Regular.woff2',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Thin.otf',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Thin.woff',
  '/dabimastools.github.io/dabimasFactor/fonts/NotoSansJP-Thin.woff2',
];

// install cache
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
    .open(CACHE_NAME)
    .then(function (cache) {
      return cache.addAll(urlsToCache);
    })
  );
});

// use cache
self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(event.request).then(function (response) {
        return response || fetch(event.request).then(function (response) {
          return caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      });
    })
  );
});

// refresh cache
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.filter(function (cacheName) {
          return cacheName !== CACHE_NAME;
        }).map(function (cacheName) {
          return caches.delete(cacheName);
        })
      );
    }).then(function () {
      clients.claim();
    })
  );
});

