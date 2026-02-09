/**
 * orz.ts Optimistic Updates
 *
 * 楽観的UI更新の実装
 * - useOptimistic hook
 * - 自動ロールバック
 * - エラーリカバリー
 */
import { createSignal } from './signals.js';
// ========================================
// Optimistic State Manager
// ========================================
/**
 * 楽観的更新マネージャーを作成
 *
 * @example
 * ```ts
 * const [todos, addTodo] = createOptimistic(
 *   initialTodos,
 *   async (newTodo) => await api.createTodo(newTodo),
 *   (todos, newTodo) => [...todos, newTodo]
 * );
 *
 * // 使用
 * addTodo({ id: '1', title: 'New Todo' });
 * // UIは即座に更新され、APIが失敗したら自動ロールバック
 * ```
 */
export function createOptimistic(initialValue, action, reducer, options = {}) {
    const { retryCount = 0, retryDelay = 1000, onError, onSuccess, onRollback, } = options;
    const [state, setState] = createSignal({
        current: initialValue,
        optimistic: initialValue,
        isPending: false,
        error: null,
    });
    async function execute(data) {
        const currentState = state();
        const previousValue = currentState.current;
        const optimisticValue = reducer(previousValue, data);
        // 楽観的に更新
        setState({
            current: previousValue,
            optimistic: optimisticValue,
            isPending: true,
            error: null,
        });
        let lastError = null;
        let attempts = 0;
        while (attempts <= retryCount) {
            try {
                const result = await action(data);
                // 成功：確定
                setState({
                    current: optimisticValue,
                    optimistic: optimisticValue,
                    isPending: false,
                    error: null,
                });
                onSuccess?.(result);
                return;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                attempts++;
                if (attempts <= retryCount) {
                    // Exponential backoff
                    await sleep(retryDelay * Math.pow(2, attempts - 1));
                }
            }
        }
        // 失敗：ロールバック
        setState({
            current: previousValue,
            optimistic: previousValue,
            isPending: false,
            error: lastError,
        });
        onRollback?.(previousValue);
        onError?.(lastError, previousValue);
    }
    return [state, execute];
}
/**
 * 順序付き楽観的更新キューを作成
 * 複数の更新を順番に処理し、失敗時は後続の更新もロールバック
 */
export function createOptimisticQueue(initialValue, action, reducer, options = {}) {
    const [value, setValue] = createSignal(initialValue);
    const [queue, setQueue] = createSignal([]);
    const [processing, setProcessing] = createSignal(false);
    async function processQueue() {
        if (processing())
            return;
        setProcessing(true);
        try {
            while (true) {
                const currentQueue = queue();
                const pendingAction = currentQueue.find(a => a.status === 'pending');
                if (!pendingAction)
                    break;
                // Update status to processing
                setQueue(currentQueue.map(a => a.id === pendingAction.id ? { ...a, status: 'processing' } : a));
                try {
                    await pendingAction.execute();
                    // Update status to success
                    setQueue(queue().map(a => a.id === pendingAction.id ? { ...a, status: 'success' } : a));
                }
                catch (error) {
                    // Rollback all pending actions
                    const currentQueue = queue();
                    for (const a of currentQueue) {
                        if (a.status === 'pending' || a.status === 'processing') {
                            a.rollback();
                        }
                    }
                    setQueue(currentQueue.map(a => ({
                        ...a,
                        status: (a.status === 'pending' || a.status === 'processing')
                            ? 'error'
                            : a.status,
                    })));
                    options.onError?.(error, value());
                    break;
                }
            }
        }
        finally {
            setProcessing(false);
        }
    }
    function enqueue(data) {
        const id = crypto.randomUUID();
        const previousValue = value();
        const optimisticValue = reducer(previousValue, data);
        // Apply optimistic update
        setValue(optimisticValue);
        const queuedAction = {
            id,
            data,
            execute: async () => {
                await action(data);
            },
            rollback: () => {
                setValue(previousValue);
                options.onRollback?.(previousValue);
            },
            status: 'pending',
        };
        setQueue([...queue(), queuedAction]);
        processQueue();
    }
    return {
        value,
        queue,
        processing,
        enqueue,
    };
}
// ========================================
// Utilities
// ========================================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * 楽観的リストヘルパー
 */
export const optimisticList = {
    /**
     * アイテムを追加
     */
    add(list, item) {
        return [...list, item];
    },
    /**
     * アイテムを削除
     */
    remove(list, predicate) {
        return list.filter(item => !predicate(item));
    },
    /**
     * アイテムを更新
     */
    update(list, predicate, updater) {
        return list.map(item => predicate(item) ? updater(item) : item);
    },
    /**
     * 先頭に追加
     */
    prepend(list, item) {
        return [item, ...list];
    },
    /**
     * 位置を指定して挿入
     */
    insert(list, index, item) {
        const result = [...list];
        result.splice(index, 0, item);
        return result;
    },
    /**
     * IDで削除
     */
    removeById(list, id) {
        return list.filter(item => item.id !== id);
    },
    /**
     * IDで更新
     */
    updateById(list, id, updates) {
        return list.map(item => item.id === id ? { ...item, ...updates } : item);
    },
};
//# sourceMappingURL=optimistic.js.map