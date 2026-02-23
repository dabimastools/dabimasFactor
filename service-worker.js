// cache name, cache files
var CACHE_NAME = 'dabimas-factor-v20260223-01';
var BASE_PATH = self.location.pathname.replace(/\/service-worker\.js$/, '/');
var urlsToCache = [
  BASE_PATH + 'index.html',
  BASE_PATH + 'json/dabimasFactor.json',
  BASE_PATH + 'json/brosData.json',
  BASE_PATH + 'json/inbreed-exceptions.json',
  BASE_PATH + 'css/style.css',
  BASE_PATH + 'css/loading.css',
  BASE_PATH + 'css/materialdesignicons.min.css',
  BASE_PATH + 'css/materialdesignicons.min.css.map',
  BASE_PATH + 'css/notosansjapanese.css',
  BASE_PATH + 'css/vuetify_compact.min.css',
  BASE_PATH + 'css/vuetify.min.css',
  BASE_PATH + 'vue/vue.min.js',
  BASE_PATH + 'vue/vuetify.js',
  BASE_PATH + 'vue/vuetify.js.map',
  BASE_PATH + 'fonts/materialdesignicons-webfont.eot',
  BASE_PATH + 'fonts/materialdesignicons-webfont.ttf',
  BASE_PATH + 'fonts/materialdesignicons-webfont.woff',
  BASE_PATH + 'fonts/materialdesignicons-webfont.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Black.otf',
  BASE_PATH + 'fonts/NotoSansJP-Black.woff',
  BASE_PATH + 'fonts/NotoSansJP-Black.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Bold.otf',
  BASE_PATH + 'fonts/NotoSansJP-Bold.woff',
  BASE_PATH + 'fonts/NotoSansJP-Bold.woff2',
  BASE_PATH + 'fonts/NotoSansJP-DemiLight.otf',
  BASE_PATH + 'fonts/NotoSansJP-DemiLight.woff',
  BASE_PATH + 'fonts/NotoSansJP-DemiLight.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Light.otf',
  BASE_PATH + 'fonts/NotoSansJP-Light.woff',
  BASE_PATH + 'fonts/NotoSansJP-Light.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Medium.otf',
  BASE_PATH + 'fonts/NotoSansJP-Medium.woff',
  BASE_PATH + 'fonts/NotoSansJP-Medium.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Regular.otf',
  BASE_PATH + 'fonts/NotoSansJP-Regular.woff',
  BASE_PATH + 'fonts/NotoSansJP-Regular.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Thin.otf',
  BASE_PATH + 'fonts/NotoSansJP-Thin.woff',
  BASE_PATH + 'fonts/NotoSansJP-Thin.woff2',
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

