// cache name, cache files
var CACHE_NAME = 'dabimas-factor-v20260310-02';
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

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isOffline() {
  return self.navigator && self.navigator.onLine === false;
}

function isCacheableResponse(response) {
  return response && response.ok;
}

function putInCache(cacheKey, response) {
  if (!isCacheableResponse(response)) {
    return Promise.resolve(response);
  }

  return caches.open(CACHE_NAME).then(function (cache) {
    cache.put(cacheKey, response.clone());
    return response;
  });
}

function fetchAndCache(request, cacheKey) {
  return fetch(request).then(function (response) {
    return putInCache(cacheKey || request, response);
  });
}

function handleNavigationRequest(event) {
  if (isOffline()) {
    return caches.match(event.request).then(function (cachedResponse) {
      return cachedResponse || caches.match(APP_SHELL_URL) || Response.error();
    });
  }

  return fetchAndCache(event.request, APP_SHELL_URL).catch(function () {
    return caches.match(event.request).then(function (cachedResponse) {
      return cachedResponse || caches.match(APP_SHELL_URL) || Response.error();
    });
  });
}

function handleAssetRequest(event) {
  return caches.match(event.request).then(function (cachedResponse) {
    if (isOffline()) {
      return cachedResponse || Response.error();
    }

    var networkResponsePromise = fetchAndCache(event.request).catch(function () {
      return cachedResponse;
    });

    if (cachedResponse) {
      event.waitUntil(networkResponsePromise.then(function () {
        return undefined;
      }));
      return cachedResponse;
    }

    return networkResponsePromise;
  });
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

// use cache
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    return;
  }

  var requestUrl = new URL(event.request.url);
  if (!isSameOrigin(requestUrl) || requestUrl.searchParams.has('app-check')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  event.respondWith(handleAssetRequest(event));
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
      return self.clients.claim();
    })
  );
});

