// ============================================================
// Service Worker：离线缓存 + 可安装（PWA）
// 缓存版本变更时，请手动递增 CACHE 名称以强制刷新缓存
// ============================================================
const CACHE = "persona-arcana-v13";

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/main.js",
  "./js/game.js",
  "./js/ui.js",
  "./js/core.js",
  "./js/data.js",
  "./js/meta.js",
  "./js/fusion.js",
  "./js/hub.js",
  "./js/vfx.js",
  "./stages.json",
  "./assets/backgrounds/battle_bg.jpg",
  "./assets/card_frames/card_frame_blue.jpg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const isHtml = e.request.mode === "navigate" || url.pathname.endsWith(".html");
  const isData = url.pathname.endsWith(".json");

  // HTML / JSON：网络优先，保证最新；离线时回退缓存
  if (isHtml || isData) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // 静态资源（JS/CSS/图片等）：stale-while-revalidate
  // 命中缓存立即返回，同时后台回源更新，确保移动端下次进入即拿到最新阵营逻辑
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});

// 允许页面主动通知立即接管（配合 main.js 的更新流程）
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});