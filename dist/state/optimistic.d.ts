/**
 * orz.ts Optimistic Updates
 *
 * 楽観的UI更新の実装
 * - useOptimistic hook
 * - 自動ロールバック
 * - エラーリカバリー
 */
import { type SignalGetter } from './signals.js';
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
export declare function createOptimistic<T, TAction>(initialValue: T, action: OptimisticAction<TAction>, reducer: (current: T, actionData: TAction) => T, options?: OptimisticOptions<T>): [SignalGetter<OptimisticState<T>>, (data: TAction) => Promise<void>];
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
export declare function createOptimisticQueue<T, TAction>(initialValue: T, action: OptimisticAction<TAction>, reducer: (current: T, actionData: TAction) => T, options?: OptimisticOptions<T>): {
    value: SignalGetter<T>;
    queue: SignalGetter<QueuedAction<TAction>[]>;
    processing: SignalGetter<boolean>;
    enqueue: (data: TAction) => void;
};
/**
 * 楽観的リストヘルパー
 */
export declare const optimisticList: {
    /**
     * アイテムを追加
     */
    add<T>(list: T[], item: T): T[];
    /**
     * アイテムを削除
     */
    remove<T>(list: T[], predicate: (item: T) => boolean): T[];
    /**
     * アイテムを更新
     */
    update<T>(list: T[], predicate: (item: T) => boolean, updater: (item: T) => T): T[];
    /**
     * 先頭に追加
     */
    prepend<T>(list: T[], item: T): T[];
    /**
     * 位置を指定して挿入
     */
    insert<T>(list: T[], index: number, item: T): T[];
    /**
     * IDで削除
     */
    removeById<T extends {
        id: string | number;
    }>(list: T[], id: string | number): T[];
    /**
     * IDで更新
     */
    updateById<T extends {
        id: string | number;
    }>(list: T[], id: string | number, updates: Partial<T>): T[];
};
export {};
//# sourceMappingURL=optimistic.d.ts.map