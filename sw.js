const CACHE_NAME = 'jiz41-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './kiyone_cyberpunk_addon.css',
  './title.png',
];

// キャッシュしない開発用ファイル（常にネットワークから取得）
const DEV_FILES = ['preview.html', 'style_new.css'];

// インストール時にキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ネットワーク優先、失敗時はキャッシュから返す
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // HuggingFace上の外部JSはキャッシュしない（常に最新を取得）
  if (url.includes('huggingface.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 開発用ファイルは常にネットワークから取得、キャッシュ不使用
  if (DEV_FILES.some(f => url.includes(f))) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
