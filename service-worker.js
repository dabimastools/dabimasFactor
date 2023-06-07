// cache name, cache files
var CACHE_NAME = 'dabimas-factor-v1';
var urlsToCache = [
    '/yanaifarm.github.io/dabimasFactor/index.html',
    '/yanaifarm.github.io/dabimasFactor/json/dabimasFactor.json',
    '/yanaifarm.github.io/dabimasFactor/css/style.css',
    '/yanaifarm.github.io/dabimasFactor/css/vuetify.min.css',
    '/yanaifarm.github.io/dabimasFactor/css/vuetify_compact.min.css',
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

