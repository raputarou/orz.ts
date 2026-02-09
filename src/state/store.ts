/**
 * orz.ts Proxy Store
 * 
 * プロキシベースのリアクティブストア
 * - createStore - プロキシストア作成
 * - 構造的共有 (Structural Sharing)
 * - サブスクリプション管理
 * - 自動UI更新
 */

import { createSignal, createEffect, batch, type SignalGetter, type SignalSetter } from './signals.js';

// ========================================
// Types
// ========================================

export type StoreValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | StoreValue[]
    | { [key: string]: StoreValue };

export type Store<T extends object> = T & {
    /** ストアの現在の状態を取得（スナップショット） */
    $snapshot: () => T;
    /** ストアを購読 */
    $subscribe: (callback: (state: T) => void) => () => void;
    /** バッチ更新 */
    $batch: (fn: () => void) => void;
    /** 状態をリセット */
    $reset: () => void;
};

export interface StoreOptions<T> {
    /** 変更時のコールバック */
    onChange?: (state: T, path: string[], value: unknown) => void;
    /** デバッグモード */
    debug?: boolean;
    /** ストア名（デバッグ用） */
    name?: string;
}

// ========================================
// Proxy Store
// ========================================

const STORE_INTERNALS = Symbol('store-internals');

interface StoreInternals<T> {
    initialState: T;
    subscribers: Set<(state: T) => void>;
    signalMap: Map<string, [SignalGetter<unknown>, SignalSetter<unknown>]>;
    options: StoreOptions<T>;
}

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
export function createStore<T extends object>(
    initialState: T,
    options: StoreOptions<T> = {}
): Store<T> {
    const internals: StoreInternals<T> = {
        initialState: structuredClone(initialState),
        subscribers: new Set(),
        signalMap: new Map(),
        options,
    };

    // Deep clone the initial state
    const state = structuredClone(initialState);

    // Get or create signal for a path
    function getSignal(path: string): [SignalGetter<unknown>, SignalSetter<unknown>] {
        if (!internals.signalMap.has(path)) {
            const value = getValueByPath(state, path);
            internals.signalMap.set(path, createSignal(value));
        }
        return internals.signalMap.get(path)!;
    }

    // Notify all subscribers
    function notify(path: string[], value: unknown): void {
        const pathStr = path.join('.');
        const [, setter] = getSignal(pathStr);
        setter(value);

        options.onChange?.(state as T, path, value);

        for (const subscriber of internals.subscribers) {
            subscriber(state as T);
        }

        if (options.debug) {
            console.log(`[Store${options.name ? `:${options.name}` : ''}] ${pathStr} =`, value);
        }
    }

    // Create reactive proxy
    function createReactiveProxy(target: object, path: string[] = []): object {
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
                    return (callback: (state: T) => void) => {
                        internals.subscribers.add(callback);
                        return () => internals.subscribers.delete(callback);
                    };
                }
                if (prop === '$batch') {
                    return (fn: () => void) => batch(fn);
                }
                if (prop === '$reset') {
                    return () => {
                        Object.assign(state, structuredClone(internals.initialState));
                        internals.signalMap.clear();
                        for (const subscriber of internals.subscribers) {
                            subscriber(state as T);
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

    return createReactiveProxy(state) as Store<T>;
}

// ========================================
// Utilities
// ========================================

/**
 * パスから値を取得
 */
function getValueByPath(obj: object, path: string): unknown {
    if (!path) return obj;

    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
        if (current === null || current === undefined) {
            return undefined;
        }
        current = (current as Record<string, unknown>)[key];
    }

    return current;
}

/**
 * ストアから選択的に値を取得する関数を作成
 */
export function createSelector<T extends object, R>(
    store: Store<T>,
    selector: (state: T) => R
): SignalGetter<R> {
    const [value, setValue] = createSignal(selector(store.$snapshot()));

    store.$subscribe((state) => {
        setValue(selector(state));
    });

    return value;
}

/**
 * 複数のストアを結合
 */
export function combineStores<T extends Record<string, object>>(
    stores: { [K in keyof T]: Store<T[K]> }
): Store<T> {
    const combined: Record<string, unknown> = {};

    for (const [key, store] of Object.entries(stores)) {
        combined[key] = store.$snapshot();
    }

    const combinedStore = createStore(combined as T);

    // Sync changes from individual stores
    for (const [key, store] of Object.entries(stores)) {
        (store as Store<object>).$subscribe((state: object) => {
            (combinedStore as unknown as Record<string, unknown>)[key] = state;
        });
    }

    return combinedStore;
}

// ========================================
// Persistence
// ========================================

export interface PersistOptions {
    /** ストレージキー */
    key: string;
    /** ストレージタイプ */
    storage?: 'localStorage' | 'sessionStorage';
    /** シリアライザー */
    serialize?: (state: unknown) => string;
    /** デシリアライザー */
    deserialize?: (data: string) => unknown;
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
export function persistStore<T extends object>(
    store: Store<T>,
    options: PersistOptions
): () => void {
    const {
        key,
        storage = 'localStorage',
        serialize = JSON.stringify,
        deserialize = JSON.parse,
    } = options;

    // Load initial state
    if (typeof window !== 'undefined') {
        const storageApi = storage === 'localStorage' ? localStorage : sessionStorage;
        const saved = storageApi.getItem(key);

        if (saved) {
            try {
                const parsed = deserialize(saved) as Partial<T>;
                Object.assign(store as object, parsed);
            } catch (e) {
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
            } catch (e) {
                console.warn(`[Store] Failed to persist state for key "${key}":`, e);
            }
        }
    });
}
