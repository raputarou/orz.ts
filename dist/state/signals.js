/**
 * orz.ts Signal System
 *
 * リアクティブプリミティブの実装
 * - createSignal - リアクティブな値
 * - createEffect - 副作用の自動追跡
 * - createComputed - 計算値
 * - createMemo - メモ化
 */
let currentSubscriber = null;
const subscriberStack = [];
/**
 * 現在のサブスクライバーをプッシュ
 */
function pushSubscriber(subscriber) {
    subscriberStack.push(subscriber);
    currentSubscriber = subscriber;
}
/**
 * 現在のサブスクライバーをポップ
 */
function popSubscriber() {
    subscriberStack.pop();
    currentSubscriber = subscriberStack[subscriberStack.length - 1] ?? null;
}
// ========================================
// Signal
// ========================================
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
export function createSignal(initialValue) {
    let value = initialValue;
    const subscribers = new Set();
    const getter = () => {
        // 現在のエフェクトに依存関係を登録
        if (currentSubscriber) {
            subscribers.add(currentSubscriber);
            currentSubscriber.dependencies.add(subscribers);
        }
        return value;
    };
    const setter = (newValue) => {
        const nextValue = typeof newValue === 'function'
            ? newValue(value)
            : newValue;
        if (!Object.is(value, nextValue)) {
            value = nextValue;
            // すべてのサブスクライバーに通知
            const toRun = new Set(subscribers);
            for (const subscriber of toRun) {
                subscriber.execute();
            }
        }
    };
    return [getter, setter];
}
// ========================================
// Effect
// ========================================
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
export function createEffect(fn) {
    let cleanup;
    const subscriber = {
        execute: () => {
            // 以前のクリーンアップを実行
            if (cleanup) {
                cleanup();
            }
            // 以前の依存関係をクリア
            for (const dep of subscriber.dependencies) {
                dep.delete(subscriber);
            }
            subscriber.dependencies.clear();
            // 新しい依存関係を追跡しながら実行
            pushSubscriber(subscriber);
            try {
                cleanup = fn();
            }
            finally {
                popSubscriber();
            }
        },
        dependencies: new Set(),
    };
    // 初回実行
    subscriber.execute();
    // クリーンアップ関数を返す
    return () => {
        if (cleanup) {
            cleanup();
        }
        for (const dep of subscriber.dependencies) {
            dep.delete(subscriber);
        }
        subscriber.dependencies.clear();
    };
}
// ========================================
// Computed
// ========================================
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
export function createComputed(fn) {
    const [value, setValue] = createSignal(undefined);
    createEffect(() => {
        setValue(fn());
    });
    return value;
}
// ========================================
// Memo
// ========================================
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
export function createMemo(fn) {
    let cached;
    let initialized = false;
    const subscribers = new Set();
    let needsUpdate = true;
    const subscriber = {
        execute: () => {
            needsUpdate = true;
            // サブスクライバーに通知
            const toRun = new Set(subscribers);
            for (const sub of toRun) {
                sub.execute();
            }
        },
        dependencies: new Set(),
    };
    return () => {
        // 現在のエフェクトに依存関係を登録
        if (currentSubscriber) {
            subscribers.add(currentSubscriber);
            currentSubscriber.dependencies.add(subscribers);
        }
        if (needsUpdate || !initialized) {
            // 依存関係をクリア
            for (const dep of subscriber.dependencies) {
                dep.delete(subscriber);
            }
            subscriber.dependencies.clear();
            // 計算を実行
            pushSubscriber(subscriber);
            try {
                cached = fn();
                initialized = true;
                needsUpdate = false;
            }
            finally {
                popSubscriber();
            }
        }
        return cached;
    };
}
// ========================================
// Batch
// ========================================
let batchDepth = 0;
const batchedUpdates = new Set();
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
export function batch(fn) {
    batchDepth++;
    try {
        return fn();
    }
    finally {
        batchDepth--;
        if (batchDepth === 0) {
            const updates = new Set(batchedUpdates);
            batchedUpdates.clear();
            for (const update of updates) {
                update();
            }
        }
    }
}
// ========================================
// Untrack
// ========================================
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
export function untrack(fn) {
    const prev = currentSubscriber;
    currentSubscriber = null;
    try {
        return fn();
    }
    finally {
        currentSubscriber = prev;
    }
}
// ========================================
// On
// ========================================
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
export function on(deps, fn, options = {}) {
    const depArray = Array.isArray(deps) ? deps : [deps];
    let prevValue;
    let initialized = options.defer !== true;
    return () => {
        const currentValue = Array.isArray(deps)
            ? depArray.map(d => d())
            : deps();
        if (initialized) {
            const result = untrack(() => fn(currentValue, prevValue));
            prevValue = currentValue;
            return result;
        }
        else {
            prevValue = currentValue;
            initialized = true;
            return undefined;
        }
    };
}
//# sourceMappingURL=signals.js.map