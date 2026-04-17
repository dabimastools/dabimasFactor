// cache name, cache files
var CACHE_NAME = 'dabimas-factor-v20260417-01';
var BASE_PATH = self.location.pathname.replace(/\/service-worker\.js$/, '/');
var APP_SHELL_URL = BASE_PATH + 'index.html';
var urlsToCache = [
  APP_SHELL_URL,
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

function isSameOriginGetRequest(request) {
  return request.method === 'GET' && new URL(request.url).origin === self.location.origin;
}

function isOffline() {
  return self.navigator && self.navigator.onLine === false;
}

function getCacheKey(request) {
  return request.mode === 'navigate' ? APP_SHELL_URL : request;
}

function matchFromCache(cache, request) {
  return cache.match(getCacheKey(request));
}

function updateCache(cache, request, response) {
  if (response && response.ok) {
    return cache.put(getCacheKey(request), response.clone());
  }

  return Promise.resolve();
}

function createNetworkRequest(request) {
  return new Request(request, { cache: 'no-cache' });
}

// install cache
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(urlsToCache);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

// online: network first / offline: cache only
self.addEventListener('fetch', function (event) {
  if (!isSameOriginGetRequest(event.request)) {
    return;
  }

  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return matchFromCache(cache, event.request).then(function (cachedResponse) {
        if (isOffline()) {
          if (cachedResponse) {
            return cachedResponse;
          }

          return Promise.reject(new Error('Offline and no cached response available.'));
        }

        return fetch(createNetworkRequest(event.request))
          .then(function (networkResponse) {
            if (networkResponse && networkResponse.ok) {
              return updateCache(cache, event.request, networkResponse).then(function () {
                return networkResponse;
              });
            }

            return cachedResponse || networkResponse;
          })
          .catch(function (error) {
            if (cachedResponse) {
              return cachedResponse;
            }

            throw error;
          });
      });
    })
  );
});

// refresh cache
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (cacheName) {
              return cacheName !== CACHE_NAME;
            })
            .map(function (cacheName) {
              return caches.delete(cacheName);
            })
        );
      })
      .then(function () {
        return clients.claim();
      })
  );
});
