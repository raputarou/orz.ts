/**
 * orz.ts PWA - Service Worker Generator
 * 
 * Service Workerの生成・管理
 */

// ========================================
// Types
// ========================================

export interface ServiceWorkerConfig {
    cacheName: string;
    version: string;
    precacheUrls: string[];
    runtimeCaching: RuntimeCachingRule[];
    skipWaiting?: boolean;
    clientsClaim?: boolean;
}

export interface RuntimeCachingRule {
    urlPattern: string | RegExp;
    handler: CacheStrategy;
    options?: CacheOptions;
}

export type CacheStrategy =
    | 'CacheFirst'
    | 'NetworkFirst'
    | 'StaleWhileRevalidate'
    | 'NetworkOnly'
    | 'CacheOnly';

export interface CacheOptions {
    cacheName?: string;
    expiration?: {
        maxEntries?: number;
        maxAgeSeconds?: number;
    };
    networkTimeoutSeconds?: number;
}

// ========================================
// Service Worker Code Generator
// ========================================

/**
 * Service Worker コードを生成
 */
export function generateServiceWorker(config: ServiceWorkerConfig): string {
    const rules = config.runtimeCaching.map(rule => ({
        ...rule,
        urlPattern: rule.urlPattern instanceof RegExp
            ? rule.urlPattern.source
            : rule.urlPattern,
    }));

    return `
// orz.ts Service Worker - Auto Generated
// Version: ${config.version}

const CACHE_NAME = '${config.cacheName}-v${config.version}';
const PRECACHE_URLS = ${JSON.stringify(config.precacheUrls, null, 2)};
const RUNTIME_CACHING = ${JSON.stringify(rules, null, 2)};

// Install event - precache
self.addEventListener('install', (event) => {
    ${config.skipWaiting ? 'self.skipWaiting();' : ''}
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[orz.ts SW] Precaching', PRECACHE_URLS.length, 'files');
            return cache.addAll(PRECACHE_URLS);
        })
    );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    ${config.clientsClaim ? 'self.clients.claim();' : ''}
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('${config.cacheName}-') && name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[orz.ts SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Find matching rule
    const rule = RUNTIME_CACHING.find((r) => {
        const pattern = new RegExp(r.urlPattern);
        return pattern.test(url.pathname) || pattern.test(event.request.url);
    });

    const strategy = rule?.handler || 'NetworkFirst';
    const options = rule?.options || {};

    event.respondWith(handleRequest(event.request, strategy, options));
});

async function handleRequest(request, strategy, options) {
    const cacheName = options.cacheName || CACHE_NAME;

    switch (strategy) {
        case 'CacheFirst':
            return cacheFirst(request, cacheName, options);
        case 'NetworkFirst':
            return networkFirst(request, cacheName, options);
        case 'StaleWhileRevalidate':
            return staleWhileRevalidate(request, cacheName);
        case 'NetworkOnly':
            return fetch(request);
        case 'CacheOnly':
            return caches.match(request);
        default:
            return networkFirst(request, cacheName, options);
    }
}

async function cacheFirst(request, cacheName, options) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return new Response('Offline', { status: 503 });
    }
}

async function networkFirst(request, cacheName, options) {
    const timeoutMs = (options.networkTimeoutSeconds || 5) * 1000;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const response = await fetch(request, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        return new Response('Offline', { status: 503 });
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => cached);
    
    return cached || fetchPromise;
}

// Background Sync
self.addEventListener('sync', (event) => {
    if (event.tag.startsWith('orz-sync-')) {
        event.waitUntil(handleBackgroundSync(event.tag));
    }
});

async function handleBackgroundSync(tag) {
    console.log('[orz.ts SW] Background sync:', tag);
    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'BACKGROUND_SYNC', tag });
    });
}

// Push notifications
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    const title = data.title || 'Notification';
    const options = {
        body: data.body,
        icon: data.icon || '/icon-192.png',
        badge: data.badge || '/badge-72.png',
        data: data.data,
    };
    
    event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            const client = clients.find(c => c.url === url && 'focus' in c);
            if (client) {
                return client.focus();
            }
            return self.clients.openWindow(url);
        })
    );
});

console.log('[orz.ts SW] Service Worker loaded, version:', '${config.version}');
`.trim();
}

// ========================================
// Registration Helper
// ========================================

export interface RegistrationResult {
    success: boolean;
    registration?: ServiceWorkerRegistration;
    error?: Error;
}

/**
 * Service Worker を登録
 */
export async function registerServiceWorker(
    scriptUrl: string = '/sw.js',
    options?: RegistrationOptions
): Promise<RegistrationResult> {
    if (!('serviceWorker' in navigator)) {
        return { success: false, error: new Error('Service Worker not supported') };
    }

    try {
        const registration = await navigator.serviceWorker.register(scriptUrl, options);
        console.log('[orz.ts] Service Worker registered:', registration.scope);
        return { success: true, registration };
    } catch (error) {
        console.error('[orz.ts] Service Worker registration failed:', error);
        return { success: false, error: error as Error };
    }
}

/**
 * Service Worker を登録解除
 */
export async function unregisterServiceWorker(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
        return false;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();

    for (const registration of registrations) {
        await registration.unregister();
    }

    return true;
}

// ========================================
// Background Sync
// ========================================

/**
 * Background Sync を登録
 */
export async function registerBackgroundSync(tag: string): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;

    const registration = await navigator.serviceWorker.ready;

    if (!('sync' in registration)) {
        console.warn('[orz.ts] Background Sync not supported');
        return false;
    }

    try {
        // @ts-expect-error - sync is not in ServiceWorkerRegistration types
        await registration.sync.register(`orz-sync-${tag}`);
        return true;
    } catch (error) {
        console.error('[orz.ts] Background Sync registration failed:', error);
        return false;
    }
}

// ========================================
// Push Notifications
// ========================================

/**
 * Push 通知の購読
 */
export async function subscribePushNotifications(
    vapidPublicKey: string
): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('[orz.ts] Push notifications not supported');
        return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
        return subscription;
    }

    try {
        const newSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
        });
        return newSubscription;
    } catch (error) {
        console.error('[orz.ts] Push subscription failed:', error);
        return null;
    }
}

/**
 * Push 通知の購読解除
 */
export async function unsubscribePushNotifications(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
        return subscription.unsubscribe();
    }

    return true;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
