/**
 * orz.ts React Hooks
 * 
 * React互換フックとorz専用フック
 */

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import type { Store } from '../state/store.js';
import { createOptimistic, type OptimisticState, type OptimisticOptions } from '../state/optimistic.js';
import { rpcCall, type SerializableValue } from '../core/rpc.js';

// ========================================
// Re-exports from React
// ========================================

export { useState, useEffect, useCallback, useRef, useMemo, useContext, useReducer } from 'react';

// ========================================
// useStore
// ========================================

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
export function useStore<T extends object>(store: Store<T>): T {
    const subscribe = useCallback(
        (callback: () => void) => {
            return store.$subscribe(() => callback());
        },
        [store]
    );

    const getSnapshot = useCallback(() => {
        return store.$snapshot();
    }, [store]);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * ストアから選択的に値を取得するフック
 * 
 * @example
 * ```tsx
 * const user = useStoreSelector(store, s => s.user);
 * ```
 */
export function useStoreSelector<T extends object, R>(
    store: Store<T>,
    selector: (state: T) => R
): R {
    const subscribe = useCallback(
        (callback: () => void) => {
            return store.$subscribe(() => callback());
        },
        [store]
    );

    const getSnapshot = useCallback(() => {
        return selector(store.$snapshot());
    }, [store, selector]);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ========================================
// useQuery
// ========================================

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

const queryCache = new Map<string, { data: unknown; timestamp: number }>();

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
export function useQuery<T>(
    key: string | unknown[],
    fetcher: () => Promise<T>,
    options: QueryOptions<T> = {}
): QueryResult<T> {
    const cacheKey = Array.isArray(key) ? JSON.stringify(key) : key;
    const {
        initialData,
        enabled = true,
        refetchInterval,
        onSuccess,
        onError,
        staleTime = 0,
    } = options;

    // Check cache
    const cached = queryCache.get(cacheKey);
    const cachedData = cached && (Date.now() - cached.timestamp < staleTime)
        ? cached.data as T
        : undefined;

    const [data, setData] = useState<T | undefined>(cachedData ?? initialData);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState(!cachedData && enabled);
    const [isFetching, setIsFetching] = useState(false);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        setError(null);

        try {
            const result = await fetcher();
            setData(result);
            queryCache.set(cacheKey, { data: result, timestamp: Date.now() });
            onSuccess?.(result);
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            setError(err);
            onError?.(err);
        } finally {
            setIsLoading(false);
            setIsFetching(false);
        }
    }, [cacheKey, fetcher, onSuccess, onError]);

    useEffect(() => {
        if (enabled) {
            fetchData();
        }
    }, [enabled, fetchData]);

    useEffect(() => {
        if (refetchInterval && enabled) {
            const interval = setInterval(fetchData, refetchInterval);
            return () => clearInterval(interval);
        }
    }, [refetchInterval, enabled, fetchData]);

    return {
        data,
        error,
        isLoading,
        isError: error !== null,
        isSuccess: data !== undefined && error === null,
        isFetching,
        refetch: fetchData,
    };
}

// ========================================
// useMutation
// ========================================

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
export function useMutation<TData, TVariables = void>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options: MutationOptions<TData, TVariables> = {}
): MutationResult<TData, TVariables> {
    const [data, setData] = useState<TData | undefined>(undefined);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await mutationFn(variables);
            setData(result);
            options.onSuccess?.(result, variables);
            options.onSettled?.(result, null, variables);
            return result;
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            setError(err);
            options.onError?.(err, variables);
            options.onSettled?.(undefined, err, variables);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [mutationFn, options]);

    const mutate = useCallback((variables: TVariables) => {
        mutateAsync(variables).catch(() => { });
    }, [mutateAsync]);

    const reset = useCallback(() => {
        setData(undefined);
        setError(null);
        setIsLoading(false);
    }, []);

    return {
        mutate,
        mutateAsync,
        data,
        error,
        isLoading,
        isError: error !== null,
        isSuccess: data !== undefined && error === null,
        reset,
    };
}

// ========================================
// useOptimistic
// ========================================

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
export function useOptimistic<T, TAction>(
    initialValue: T,
    action: (data: TAction) => Promise<void>,
    reducer: (current: T, actionData: TAction) => T,
    options: OptimisticOptions<T> = {}
): [OptimisticState<T>, (data: TAction) => Promise<void>] {
    const optimisticRef = useRef<ReturnType<typeof createOptimistic<T, TAction>> | null>(null);

    if (!optimisticRef.current) {
        optimisticRef.current = createOptimistic(
            initialValue,
            action,
            reducer,
            options
        );
    }

    const [optimisticState, execute] = optimisticRef.current;

    const [state, setState] = useState(optimisticState());

    useEffect(() => {
        // Re-sync when signal changes
        const checkState = () => {
            const newState = optimisticState();
            setState(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(newState)) {
                    return newState;
                }
                return prev;
            });
        };

        const interval = setInterval(checkState, 16);
        return () => clearInterval(interval);
    }, [optimisticState]);

    return [state, execute];
}

// ========================================
// useServerAction
// ========================================

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
export function useServerAction<TResult = unknown>(
    functionName: string
): (...args: SerializableValue[]) => Promise<TResult> {
    return useCallback(
        (...args: SerializableValue[]) => rpcCall<TResult>(functionName, args),
        [functionName]
    );
}

// ========================================
// useRPC
// ========================================

/**
 * RPC呼び出しをuseQuery形式で使用
 */
export function useRPC<T>(
    functionName: string,
    args: SerializableValue[] = [],
    options: QueryOptions<T> = {}
): QueryResult<T> {
    const key = [functionName, ...args];

    return useQuery(
        key,
        () => rpcCall<T>(functionName, args),
        options
    );
}

// ========================================
// useDebounce
// ========================================

/**
 * デバウンスフック
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

// ========================================
// useThrottle
// ========================================

/**
 * スロットルフック
 */
export function useThrottle<T>(value: T, interval: number): T {
    const [throttledValue, setThrottledValue] = useState(value);
    const lastUpdated = useRef(Date.now());

    useEffect(() => {
        const now = Date.now();
        if (now - lastUpdated.current >= interval) {
            lastUpdated.current = now;
            setThrottledValue(value);
        } else {
            const timer = setTimeout(() => {
                lastUpdated.current = Date.now();
                setThrottledValue(value);
            }, interval - (now - lastUpdated.current));
            return () => clearTimeout(timer);
        }
    }, [value, interval]);

    return throttledValue;
}
