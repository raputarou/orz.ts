/**
 * orz.ts Middleware Types
 * 
 * ミドルウェアシステムの型定義
 */

import type { Context } from '../core/context.js';

// ========================================
// Middleware Interface
// ========================================

/**
 * ミドルウェアインターフェース（クラス型）
 */
export interface Middleware {
    /** 前処理 */
    before?(ctx: Context, metadata?: unknown): void | Promise<void>;

    /** 後処理 */
    after?(ctx: Context, result: unknown, metadata?: unknown): unknown | Promise<unknown>;

    /** エラー処理 */
    onError?(ctx: Context, error: Error, metadata?: unknown): void | Promise<void>;
}

/**
 * ミドルウェア関数型
 */
export type MiddlewareFn = (
    ctx: Context,
    metadata?: unknown
) => void | Promise<void>;

/**
 * ミドルウェアの種類
 */
export type MiddlewareType = Middleware | MiddlewareFn | (new () => Middleware);

// ========================================
// Middleware Chain
// ========================================

export interface MiddlewareChain {
    /** ミドルウェアを追加 */
    use(middleware: MiddlewareType): MiddlewareChain;

    /** 実行 */
    execute<T>(ctx: Context, handler: () => T | Promise<T>): Promise<T>;
}

/**
 * ミドルウェアチェーンを作成
 */
export function createMiddlewareChain(): MiddlewareChain {
    const middlewares: MiddlewareType[] = [];

    return {
        use(middleware: MiddlewareType) {
            middlewares.push(middleware);
            return this;
        },

        async execute<T>(ctx: Context, handler: () => T | Promise<T>): Promise<T> {
            const instances: Middleware[] = [];

            // Instantiate and run before hooks
            for (const mw of middlewares) {
                const instance = instantiateMiddleware(mw);
                instances.push(instance);

                if (instance.before) {
                    await instance.before(ctx);
                }
            }

            let result: T;
            let error: Error | null = null;

            try {
                result = await handler();
            } catch (e) {
                error = e instanceof Error ? e : new Error(String(e));

                // Run error hooks in reverse order
                for (let i = instances.length - 1; i >= 0; i--) {
                    const instance = instances[i];
                    if (instance.onError) {
                        await instance.onError(ctx, error);
                    }
                }

                throw error;
            }

            // Run after hooks in reverse order
            for (let i = instances.length - 1; i >= 0; i--) {
                const instance = instances[i];
                if (instance.after) {
                    const transformed = await instance.after(ctx, result);
                    if (transformed !== undefined) {
                        result = transformed as T;
                    }
                }
            }

            return result;
        },
    };
}

/**
 * ミドルウェアをインスタンス化
 */
function instantiateMiddleware(middleware: MiddlewareType): Middleware {
    // Function type
    if (typeof middleware === 'function' && !middleware.prototype?.before) {
        return {
            before: middleware as MiddlewareFn,
        };
    }

    // Class type
    if (typeof middleware === 'function') {
        return new (middleware as new () => Middleware)();
    }

    // Object type
    return middleware as Middleware;
}

// ========================================
// Middleware Decorator Helpers
// ========================================

/**
 * ミドルウェアメタデータ
 */
export interface MiddlewareMetadata {
    /** ミドルウェア名 */
    name: string;
    /** 優先度（小さいほど先に実行） */
    priority?: number;
    /** オプション */
    options?: Record<string, unknown>;
}

/**
 * ミドルウェアファクトリ
 */
export type MiddlewareFactory<T = unknown> = (options?: T) => MiddlewareType;
