// cache name, cache files
var CACHE_NAME = 'dabimas-factor-v20260703-08';
var BASE_PATH = self.location.pathname.replace(/\/service-worker\.js$/, '/');
var APP_SHELL_URL = BASE_PATH + 'index.html';
// プリキャッシュは「実行時に実際に使われるもの」だけに絞る。
// - フォントは woff2 のみ。モダンブラウザは @font-face の woff2 だけを取得するため、
//   otf / woff / eot / ttf を addAll してもダウンロード帯域とストレージを浪費するだけ。
// - source map（*.map）と未リンクの vuetify.min.css は実行時に不要なので除外。
// - js/css は cache-first（後述）で初回アクセス時に runtime cache されるため、
//   ここに載せていないもの（factor-dialog.css 等）もオフライン対応される。
var urlsToCache = [
  APP_SHELL_URL,
  // 初期表示用の軽量 summary を install cache する（案 B）。
  BASE_PATH + 'json/dabimasFactor.summary.json',
  // detail chunk（json/dabimasFactor-details/*.json）は install では addAll しない。
  // 1 ファイルの 404 で install 全体が失敗する（指摘 C）ため、fetch ハンドラの
  // network-first 経路で runtime cache される。アプリ側 prefetch で順次温める。
  // 旧 full JSON は移行期間の fallback として残す（summary 取得失敗時の退避先）。
  BASE_PATH + 'json/dabimasFactor.json',
  BASE_PATH + 'json/brosData.json',
  BASE_PATH + 'json/inbreed-exceptions.json',
  BASE_PATH + 'css/style.css',
  BASE_PATH + 'css/mobile.css',
  BASE_PATH + 'css/loading.css',
  BASE_PATH + 'css/materialdesignicons.min.css',
  BASE_PATH + 'css/notosansjapanese.css',
  BASE_PATH + 'css/vuetify_compact.min.css',
  BASE_PATH + 'vue/vue.min.js',
  BASE_PATH + 'vue/vuetify.js',
  BASE_PATH + 'cdn/html2canvas.min.js',
  BASE_PATH + 'fonts/materialdesignicons-webfont.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Black.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Bold.woff2',
  BASE_PATH + 'fonts/NotoSansJP-DemiLight.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Light.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Medium.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Regular.woff2',
  BASE_PATH + 'fonts/NotoSansJP-Thin.woff2',
];

function isSameOriginGetRequest(request) {
  return request.method === 'GET' && new URL(request.url).origin === self.location.origin;
}

// 日次で更新され得るデータ。これだけは network-first で鮮度を優先する。
function isDataRequest(request) {
  return /\/json\//.test(new URL(request.url).pathname);
}

// フォント・vendored JS/CSS など、デプロイ毎に CACHE_NAME を bump する前提で
// 不変とみなせるアセット。cache-first にしてオンラインでも再取得しない。
function isStaticAsset(request) {
  return request.mode !== 'navigate' && !isDataRequest(request);
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

  // 静的アセットは cache-first。キャッシュにあればネットワークに行かない（オンラインでも）。
  if (isStaticAsset(event.request)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(event.request).then(function (cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then(function (networkResponse) {
            return updateCache(cache, event.request, networkResponse).then(function () {
              return networkResponse;
            });
          });
        });
      })
    );
    return;
  }

  // データ（json/）とナビゲーションは network-first で鮮度優先、オフライン時はキャッシュ。
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
