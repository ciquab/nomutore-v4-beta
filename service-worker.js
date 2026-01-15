const CACHE_NAME = 'nomutore-v4.0.2'; // Major Update

// アプリケーションを構成する全ファイル
// これらをキャッシュすることでオフライン起動が可能になります
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './style.css',
    
    // Core Logic & Data
    './main.js',
    './constants.js',
    './store.js',
    './logic.js',
    './service.js',
    './timer.js',
    './dataManager.js',
    './errorHandler.js',

    // UI Modules
    './ui/index.js',
    './ui/dom.js',
    './ui/state.js',
    './ui/orb.js',           // Replaced beerTank.js
    './ui/liverRank.js',
    './ui/checkStatus.js',
    './ui/weekly.js',
    './ui/chart.js',
    './ui/logList.js',
    './ui/modal.js',
    './ui/beerStats.js',     // New (Phase 3.1)
    './ui/archiveManager.js',// New (Phase 3.2)

    // Assets
    './icon-192.png',

    // External Libraries (CDNs) - Offline Support
    // ※外部リソースをキャッシュすることで、オフライン時でも見た目を維持します
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+JP:wght@400;500;700&display=swap',
    'https://unpkg.com/@phosphor-icons/web',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://unpkg.com/dexie@3.2.4/dist/dexie.js',
    // ES Modules as external resources
    'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/+esm',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/+esm'
];

// インストール処理
self.addEventListener('install', (event) => {
    self.skipWaiting(); // 新しいSWをすぐに有効化
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Pre-caching app shell');
                // 外部リソースを含むため、一部が失敗しても他をキャッシュするように
                // Promise.allSettled のような挙動が理想ですが、
                // 基本的には addAll で一括キャッシュを試みます。
                // 失敗した場合は次回アクセス時に個別にキャッシュされます。
                return cache.addAll(APP_SHELL).catch(err => {
                    console.warn('[ServiceWorker] Some assets failed to cache:', err);
                });
            })
    );
});

// 古いキャッシュの削除
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// リクエスト処理（Stale-While-Revalidate 戦略）
// キャッシュがあれば即座に返し、裏でネットワークから最新を取得してキャッシュを更新する
self.addEventListener('fetch', (event) => {
    // POSTメソッドやchrome-extensionスキームなどはキャッシュしない
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // 1. キャッシュにあればそれを返す (高速表示)
                if (cachedResponse) {
                    // 裏でネットワークから最新を取得してキャッシュ更新 (次回起動用)
                    event.waitUntil(
                        fetch(event.request).then((networkResponse) => {
                             if (networkResponse && networkResponse.status === 200) {
                                 const responseToCache = networkResponse.clone();
                                 caches.open(CACHE_NAME).then((cache) => {
                                     cache.put(event.request, responseToCache);
                                 });
                             }
                        }).catch(() => {
                            // オフライン時は何もしない
                        })
                    );
                    
                    return cachedResponse;
                }

                // 2. キャッシュになければネットワークに取りに行く
                return fetch(event.request).then((networkResponse) => {
                    // 有効なレスポンスでなければそのまま返す
                    if (!networkResponse || (networkResponse.status !== 200 && networkResponse.status !== 0)) {
                        return networkResponse;
                    }

                    // 取得したリソースをキャッシュに保存
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                }).catch((err) => {
                    // オフラインかつキャッシュにもない場合
                    console.error('[ServiceWorker] Fetch failed:', err);
                    // 必要であればオフライン用のフォールバックページを返す処理をここに記述
                });
            })
    );
});