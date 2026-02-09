/**
 * orz.ts Optimistic Updates
 * 
 * 楽観的UI更新の実装
 * - useOptimistic hook
 * - 自動ロールバック
 * - エラーリカバリー
 */

import { createSignal, type SignalGetter } from './signals.js';

// ========================================
// Types
// ========================================

export type OptimisticAction<T, R = void> = (data: T) => Promise<R>;

export interface OptimisticState<T> {
    /** 現在の値 */
    current: T;
    /** 楽観的に適用された値 */
    optimistic: T;
    /** ペンディング中かどうか */
    isPending: boolean;
    /** エラー */
    error: Error | null;
}

export interface OptimisticOptions<T> {
    /** リトライ回数 */
    retryCount?: number;
    /** リトライ間隔（ミリ秒） */
    retryDelay?: number;
    /** エラー時のコールバック */
    onError?: (error: Error, rollbackValue: T) => void;
    /** 成功時のコールバック */
    onSuccess?: (result: unknown) => void;
    /** ロールバック時のコールバック */
    onRollback?: (value: T) => void;
}

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
export function createOptimistic<T, TAction>(
    initialValue: T,
    action: OptimisticAction<TAction>,
    reducer: (current: T, actionData: TAction) => T,
    options: OptimisticOptions<T> = {}
): [SignalGetter<OptimisticState<T>>, (data: TAction) => Promise<void>] {
    const {
        retryCount = 0,
        retryDelay = 1000,
        onError,
        onSuccess,
        onRollback,
    } = options;

    const [state, setState] = createSignal<OptimisticState<T>>({
        current: initialValue,
        optimistic: initialValue,
        isPending: false,
        error: null,
    });

    async function execute(data: TAction): Promise<void> {
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

        let lastError: Error | null = null;
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

            } catch (error) {
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
        onError?.(lastError!, previousValue);
    }

    return [state, execute];
}

// ========================================
// Optimistic Queue
// ========================================

interface QueuedAction<T> {
    id: string;
    data: T;
    execute: () => Promise<void>;
    rollback: () => void;
    status: 'pending' | 'processing' | 'success' | 'error';
}

/**
 * 順序付き楽観的更新キューを作成
 * 複数の更新を順番に処理し、失敗時は後続の更新もロールバック
 */
export function createOptimisticQueue<T, TAction>(
    initialValue: T,
    action: OptimisticAction<TAction>,
    reducer: (current: T, actionData: TAction) => T,
    options: OptimisticOptions<T> = {}
) {
    const [value, setValue] = createSignal(initialValue);
    const [queue, setQueue] = createSignal<QueuedAction<TAction>[]>([]);
    const [processing, setProcessing] = createSignal(false);

    async function processQueue(): Promise<void> {
        if (processing()) return;
        setProcessing(true);

        try {
            while (true) {
                const currentQueue = queue();
                const pendingAction = currentQueue.find(a => a.status === 'pending');

                if (!pendingAction) break;

                // Update status to processing
                setQueue(currentQueue.map(a =>
                    a.id === pendingAction.id ? { ...a, status: 'processing' as const } : a
                ));

                try {
                    await pendingAction.execute();

                    // Update status to success
                    setQueue(queue().map(a =>
                        a.id === pendingAction.id ? { ...a, status: 'success' as const } : a
                    ));

                } catch (error) {
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
                            ? 'error' as const
                            : a.status,
                    })));

                    options.onError?.(error as Error, value());
                    break;
                }
            }
        } finally {
            setProcessing(false);
        }
    }

    function enqueue(data: TAction): void {
        const id = crypto.randomUUID();
        const previousValue = value();
        const optimisticValue = reducer(previousValue, data);

        // Apply optimistic update
        setValue(optimisticValue);

        const queuedAction: QueuedAction<TAction> = {
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

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 楽観的リストヘルパー
 */
export const optimisticList = {
    /**
     * アイテムを追加
     */
    add<T>(list: T[], item: T): T[] {
        return [...list, item];
    },

    /**
     * アイテムを削除
     */
    remove<T>(list: T[], predicate: (item: T) => boolean): T[] {
        return list.filter(item => !predicate(item));
    },

    /**
     * アイテムを更新
     */
    update<T>(list: T[], predicate: (item: T) => boolean, updater: (item: T) => T): T[] {
        return list.map(item => predicate(item) ? updater(item) : item);
    },

    /**
     * 先頭に追加
     */
    prepend<T>(list: T[], item: T): T[] {
        return [item, ...list];
    },

    /**
     * 位置を指定して挿入
     */
    insert<T>(list: T[], index: number, item: T): T[] {
        const result = [...list];
        result.splice(index, 0, item);
        return result;
    },

    /**
     * IDで削除
     */
    removeById<T extends { id: string | number }>(list: T[], id: string | number): T[] {
        return list.filter(item => item.id !== id);
    },

    /**
     * IDで更新
     */
    updateById<T extends { id: string | number }>(
        list: T[],
        id: string | number,
        updates: Partial<T>
    ): T[] {
        return list.map(item =>
            item.id === id ? { ...item, ...updates } : item
        );
    },
};
