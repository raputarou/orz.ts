/**
 * orz.ts Signal System
 *
 * リアクティブプリミティブの実装
 * - createSignal - リアクティブな値
 * - createEffect - 副作用の自動追跡
 * - createComputed - 計算値
 * - createMemo - メモ化
 */
export type SignalGetter<T> = () => T;
export type SignalSetter<T> = (value: T | ((prev: T) => T)) => void;
export type Signal<T> = [SignalGetter<T>, SignalSetter<T>];
export type EffectFn = () => void | (() => void);
export type CleanupFn = () => void;
/**
 * リアクティブな値を作成
 *
 * @example
 * ```ts
 * const [count, setCount] = createSignal(0);
 * console.log(count()); // 0
 * setCount(1);
 * console.log(count()); // 1
 * setCount(prev => prev + 1);
 * console.log(count()); // 2
 * ```
 */
export declare function createSignal<T>(initialValue: T): Signal<T>;
/**
 * 副作用を作成し、依存関係を自動追跡
 *
 * @example
 * ```ts
 * const [count, setCount] = createSignal(0);
 *
 * createEffect(() => {
 *   console.log('Count is:', count());
 * });
 *
 * setCount(1); // 自動的に "Count is: 1" が出力される
 * ```
 */
export declare function createEffect(fn: EffectFn): CleanupFn;
/**
 * 計算値を作成（他のシグナルから派生）
 *
 * @example
 * ```ts
 * const [count, setCount] = createSignal(0);
 * const doubled = createComputed(() => count() * 2);
 *
 * console.log(doubled()); // 0
 * setCount(5);
 * console.log(doubled()); // 10
 * ```
 */
export declare function createComputed<T>(fn: () => T): SignalGetter<T>;
/**
 * メモ化された計算値を作成
 * キャッシュされ、依存関係が変わらない限り再計算されない
 *
 * @example
 * ```ts
 * const [items, setItems] = createSignal([1, 2, 3]);
 * const sum = createMemo(() => {
 *   console.log('Computing sum...');
 *   return items().reduce((a, b) => a + b, 0);
 * });
 *
 * console.log(sum()); // "Computing sum..." → 6
 * console.log(sum()); // 6 (キャッシュ使用)
 * ```
 */
export declare function createMemo<T>(fn: () => T): SignalGetter<T>;
/**
 * 複数の更新をバッチ処理
 *
 * @example
 * ```ts
 * batch(() => {
 *   setCount(1);
 *   setName('Alice');
 *   // エフェクトはバッチ終了後に1回だけ実行
 * });
 * ```
 */
export declare function batch<T>(fn: () => T): T;
/**
 * 依存関係を追跡せずに値を読み取る
 *
 * @example
 * ```ts
 * createEffect(() => {
 *   console.log(untrack(() => count())); // countの変更で再実行されない
 * });
 * ```
 */
export declare function untrack<T>(fn: () => T): T;
/**
 * 特定の依存関係のみを追跡
 *
 * @example
 * ```ts
 * createEffect(on(
 *   count,
 *   (value, prevValue) => {
 *     console.log(`Count changed from ${prevValue} to ${value}`);
 *   }
 * ));
 * ```
 */
export declare function on<T, U>(deps: SignalGetter<T> | SignalGetter<T>[], fn: (value: T | T[], prevValue: T | T[] | undefined) => U, options?: {
    defer?: boolean;
}): () => U | undefined;
//# sourceMappingURL=signals.d.ts.map