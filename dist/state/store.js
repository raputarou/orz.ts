/**
 * orz.ts Proxy Store
 *
 * プロキシベースのリアクティブストア
 * - createStore - プロキシストア作成
 * - 構造的共有 (Structural Sharing)
 * - サブスクリプション管理
 * - 自動UI更新
 */
import { createSignal, batch } from './signals.js';
// ========================================
// Proxy Store
// ========================================
const STORE_INTERNALS = Symbol('store-internals');
/**
 * プロキシストアを作成
 *
 * @example
 * ```ts
 * const store = createStore({
 *   user: null,
 *   cart: [],
 *   count: 0
 * });
 *
 * // 直接代入でUI更新
 * store.user = { id: '1', name: 'Alice' };
 * store.count++;
 * store.cart.push({ id: '1', name: 'Product' });
 *
 * // スナップショット取得
 * console.log(store.$snapshot());
 *
 * // 購読
 * const unsubscribe = store.$subscribe(state => {
 *   console.log('State changed:', state);
 * });
 * ```
 */
export function createStore(initialState, options = {}) {
    const internals = {
        initialState: structuredClone(initialState),
        subscribers: new Set(),
        signalMap: new Map(),
        options,
    };
    // Deep clone the initial state
    const state = structuredClone(initialState);
    // Get or create signal for a path
    function getSignal(path) {
        if (!internals.signalMap.has(path)) {
            const value = getValueByPath(state, path);
            internals.signalMap.set(path, createSignal(value));
        }
        return internals.signalMap.get(path);
    }
    // Notify all subscribers
    function notify(path, value) {
        const pathStr = path.join('.');
        const [, setter] = getSignal(pathStr);
        setter(value);
        options.onChange?.(state, path, value);
        for (const subscriber of internals.subscribers) {
            subscriber(state);
        }
        if (options.debug) {
            console.log(`[Store${options.name ? `:${options.name}` : ''}] ${pathStr} =`, value);
        }
    }
    // Create reactive proxy
    function createReactiveProxy(target, path = []) {
        return new Proxy(target, {
            get(obj, prop) {
                // Handle special properties
                if (prop === STORE_INTERNALS) {
                    return internals;
                }
                if (prop === '$snapshot') {
                    return () => structuredClone(state);
                }
                if (prop === '$subscribe') {
                    return (callback) => {
                        internals.subscribers.add(callback);
                        return () => internals.subscribers.delete(callback);
                    };
                }
                if (prop === '$batch') {
                    return (fn) => batch(fn);
                }
                if (prop === '$reset') {
                    return () => {
                        Object.assign(state, structuredClone(internals.initialState));
                        internals.signalMap.clear();
                        for (const subscriber of internals.subscribers) {
                            subscriber(state);
                        }
                    };
                }
                if (typeof prop === 'symbol') {
                    return Reflect.get(obj, prop);
                }
                const currentPath = [...path, prop];
                const pathStr = currentPath.join('.');
                const [getter] = getSignal(pathStr);
                // Trigger dependency tracking
                getter();
                const value = Reflect.get(obj, prop);
                // Recursively create proxy for nested objects
                if (value !== null && typeof value === 'object') {
                    return createReactiveProxy(value, currentPath);
                }
                return value;
            },
            set(obj, prop, value) {
                if (typeof prop === 'symbol') {
                    return Reflect.set(obj, prop, value);
                }
                const currentPath = [...path, prop];
                const oldValue = Reflect.get(obj, prop);
                if (!Object.is(oldValue, value)) {
                    Reflect.set(obj, prop, value);
                    notify(currentPath, value);
                }
                return true;
            },
            deleteProperty(obj, prop) {
                if (typeof prop === 'symbol') {
                    return Reflect.deleteProperty(obj, prop);
                }
                const currentPath = [...path, prop];
                const result = Reflect.deleteProperty(obj, prop);
                if (result) {
                    notify(currentPath, undefined);
                }
                return result;
            },
        });
    }
    return createReactiveProxy(state);
}
// ========================================
// Utilities
// ========================================
/**
 * パスから値を取得
 */
function getValueByPath(obj, path) {
    if (!path)
        return obj;
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current === null || current === undefined) {
            return undefined;
        }
        current = current[key];
    }
    return current;
}
/**
 * ストアから選択的に値を取得する関数を作成
 */
export function createSelector(store, selector) {
    const [value, setValue] = createSignal(selector(store.$snapshot()));
    store.$subscribe((state) => {
        setValue(selector(state));
    });
    return value;
}
/**
 * 複数のストアを結合
 */
export function combineStores(stores) {
    const combined = {};
    for (const [key, store] of Object.entries(stores)) {
        combined[key] = store.$snapshot();
    }
    const combinedStore = createStore(combined);
    // Sync changes from individual stores
    for (const [key, store] of Object.entries(stores)) {
        store.$subscribe((state) => {
            combinedStore[key] = state;
        });
    }
    return combinedStore;
}
/**
 * ストアを永続化
 *
 * @example
 * ```ts
 * const store = createStore({ count: 0 });
 * persistStore(store, { key: 'my-app-state' });
 * ```
 */
export function persistStore(store, options) {
    const { key, storage = 'localStorage', serialize = JSON.stringify, deserialize = JSON.parse, } = options;
    // Load initial state
    if (typeof window !== 'undefined') {
        const storageApi = storage === 'localStorage' ? localStorage : sessionStorage;
        const saved = storageApi.getItem(key);
        if (saved) {
            try {
                const parsed = deserialize(saved);
                Object.assign(store, parsed);
            }
            catch (e) {
                console.warn(`[Store] Failed to load persisted state for key "${key}":`, e);
            }
        }
    }
    // Subscribe to changes
    return store.$subscribe((state) => {
        if (typeof window !== 'undefined') {
            const storageApi = storage === 'localStorage' ? localStorage : sessionStorage;
            try {
                storageApi.setItem(key, serialize(state));
            }
            catch (e) {
                console.warn(`[Store] Failed to persist state for key "${key}":`, e);
            }
        }
    });
}
//# sourceMappingURL=store.js.map