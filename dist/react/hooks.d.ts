/**
 * orz.ts React Hooks
 *
 * React互換フックとorz専用フック
 */
import type { Store } from '../state/store.js';
import { type OptimisticState, type OptimisticOptions } from '../state/optimistic.js';
import { type SerializableValue } from '../core/rpc.js';
export { useState, useEffect, useCallback, useRef, useMemo, useContext, useReducer } from 'react';
/**
 * プロキシ・ストアにアクセスするフック
 *
 * @example
 * ```tsx
 * const store = createStore({ count: 0, user: null });
 *
 * function Counter() {
 *   const { count } = useStore(store);
 *   return <div>{count}</div>;
 * }
 * ```
 */
export declare function useStore<T extends object>(store: Store<T>): T;
/**
 * ストアから選択的に値を取得するフック
 *
 * @example
 * ```tsx
 * const user = useStoreSelector(store, s => s.user);
 * ```
 */
export declare function useStoreSelector<T extends object, R>(store: Store<T>, selector: (state: T) => R): R;
export interface QueryOptions<T> {
    /** 初期データ */
    initialData?: T;
    /** 自動実行しない場合はtrue */
    enabled?: boolean;
    /** リフェッチ間隔（ミリ秒） */
    refetchInterval?: number;
    /** 成功時コールバック */
    onSuccess?: (data: T) => void;
    /** エラー時コールバック */
    onError?: (error: Error) => void;
    /** キャッシュキー */
    cacheKey?: string;
    /** 古いデータを表示する時間（ミリ秒） */
    staleTime?: number;
}
export interface QueryResult<T> {
    data: T | undefined;
    error: Error | null;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    isFetching: boolean;
    refetch: () => Promise<void>;
}
/**
 * 非同期データ取得フック（React Query風）
 *
 * @example
 * ```tsx
 * function UserProfile({ userId }) {
 *   const { data: user, isLoading, error } = useQuery(
 *     ['user', userId],
 *     () => getUser(userId)
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *   return <div>{user.name}</div>;
 * }
 * ```
 */
export declare function useQuery<T>(key: string | unknown[], fetcher: () => Promise<T>, options?: QueryOptions<T>): QueryResult<T>;
export interface MutationOptions<TData, TVariables> {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
}
export interface MutationResult<TData, TVariables> {
    mutate: (variables: TVariables) => void;
    mutateAsync: (variables: TVariables) => Promise<TData>;
    data: TData | undefined;
    error: Error | null;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    reset: () => void;
}
/**
 * ミューテーションフック
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useMutation(
 *   (data) => createUser(data),
 *   {
 *     onSuccess: () => {
 *       queryClient.invalidateQueries(['users']);
 *     }
 *   }
 * );
 * ```
 */
export declare function useMutation<TData, TVariables = void>(mutationFn: (variables: TVariables) => Promise<TData>, options?: MutationOptions<TData, TVariables>): MutationResult<TData, TVariables>;
/**
 * 楽観的更新フック
 *
 * @example
 * ```tsx
 * const [todos, addTodo] = useOptimistic(
 *   initialTodos,
 *   async (newTodo) => await createTodo(newTodo),
 *   (todos, newTodo) => [...todos, newTodo]
 * );
 * ```
 */
export declare function useOptimistic<T, TAction>(initialValue: T, action: (data: TAction) => Promise<void>, reducer: (current: T, actionData: TAction) => T, options?: OptimisticOptions<T>): [OptimisticState<T>, (data: TAction) => Promise<void>];
/**
 * サーバーアクション呼び出しフック
 *
 * @example
 * ```tsx
 * const updateUser = useServerAction('UserController.updateUser');
 *
 * const handleSubmit = async (data) => {
 *   await updateUser(userId, data);
 * };
 * ```
 */
export declare function useServerAction<TResult = unknown>(functionName: string): (...args: SerializableValue[]) => Promise<TResult>;
/**
 * RPC呼び出しをuseQuery形式で使用
 */
export declare function useRPC<T>(functionName: string, args?: SerializableValue[], options?: QueryOptions<T>): QueryResult<T>;
/**
 * デバウンスフック
 */
export declare function useDebounce<T>(value: T, delay: number): T;
/**
 * スロットルフック
 */
export declare function useThrottle<T>(value: T, interval: number): T;
//# sourceMappingURL=hooks.d.ts.map