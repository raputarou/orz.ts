/**
 * orz.ts Proxy Store
 *
 * プロキシベースのリアクティブストア
 * - createStore - プロキシストア作成
 * - 構造的共有 (Structural Sharing)
 * - サブスクリプション管理
 * - 自動UI更新
 */
import { type SignalGetter } from './signals.js';
export type StoreValue = string | number | boolean | null | undefined | StoreValue[] | {
    [key: string]: StoreValue;
};
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
export declare function createStore<T extends object>(initialState: T, options?: StoreOptions<T>): Store<T>;
/**
 * ストアから選択的に値を取得する関数を作成
 */
export declare function createSelector<T extends object, R>(store: Store<T>, selector: (state: T) => R): SignalGetter<R>;
/**
 * 複数のストアを結合
 */
export declare function combineStores<T extends Record<string, object>>(stores: {
    [K in keyof T]: Store<T[K]>;
}): Store<T>;
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
export declare function persistStore<T extends object>(store: Store<T>, options: PersistOptions): () => void;
//# sourceMappingURL=store.d.ts.map