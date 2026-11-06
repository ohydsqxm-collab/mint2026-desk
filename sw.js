/* 离线缓存：有网的时候先拿最新版并存一份，没网或网太慢就用存下的那份。
   四个 app 共用这一个文件，各自放在自己的仓库里、和 index.html 放一起。
   缓存名里带着 app 自己的路径，所以几个 app 之间互不影响。 */
var SCOPE = self.registration.scope;
var CACHE = "offline-v1 " + SCOPE;
var WAIT_MS = 4000;

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.add("./"); }).catch(function () {})
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf("offline-") === 0 && k.slice(-(SCOPE.length + 1)) === " " + SCOPE && k !== CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(caches.open(CACHE).then(function (cache) {
    var net = fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        cache.put(req, copy).catch(function () {});
        if (req.mode === "navigate") cache.put("./", res.clone()).catch(function () {});
      }
      return res;
    });
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      if (!hit && req.mode === "navigate") return cache.match("./");
      return hit;
    }).then(function (cached) {
      if (!cached) return net;
      return Promise.race([
        net.catch(function () { return cached; }),
        new Promise(function (r) { setTimeout(function () { r(cached); }, WAIT_MS); })
      ]);
    });
  }));
});
