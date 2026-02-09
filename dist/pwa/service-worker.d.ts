/**
 * orz.ts PWA - Service Worker Generator
 *
 * Service Workerの生成・管理
 */
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
export type CacheStrategy = 'CacheFirst' | 'NetworkFirst' | 'StaleWhileRevalidate' | 'NetworkOnly' | 'CacheOnly';
export interface CacheOptions {
    cacheName?: string;
    expiration?: {
        maxEntries?: number;
        maxAgeSeconds?: number;
    };
    networkTimeoutSeconds?: number;
}
/**
 * Service Worker コードを生成
 */
export declare function generateServiceWorker(config: ServiceWorkerConfig): string;
export interface RegistrationResult {
    success: boolean;
    registration?: ServiceWorkerRegistration;
    error?: Error;
}
/**
 * Service Worker を登録
 */
export declare function registerServiceWorker(scriptUrl?: string, options?: RegistrationOptions): Promise<RegistrationResult>;
/**
 * Service Worker を登録解除
 */
export declare function unregisterServiceWorker(): Promise<boolean>;
/**
 * Background Sync を登録
 */
export declare function registerBackgroundSync(tag: string): Promise<boolean>;
/**
 * Push 通知の購読
 */
export declare function subscribePushNotifications(vapidPublicKey: string): Promise<PushSubscription | null>;
/**
 * Push 通知の購読解除
 */
export declare function unsubscribePushNotifications(): Promise<boolean>;
//# sourceMappingURL=service-worker.d.ts.map