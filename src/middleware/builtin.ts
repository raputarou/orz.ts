/**
 * orz.ts Built-in Middlewares
 * 
 * ビルトインミドルウェア実装
 */

import type { Context } from '../core/context.js';
import type { Middleware, MiddlewareFn } from './types.js';

// ========================================
// Logging Middleware
// ========================================

export interface LoggingOptions {
    /** ログレベル */
    level?: 'debug' | 'info' | 'warn' | 'error';
    /** タイムスタンプ形式 */
    timestamp?: boolean;
    /** 引数をログに含める */
    logArgs?: boolean;
    /** 結果をログに含める */
    logResult?: boolean;
    /** カスタムロガー */
    logger?: (message: string, data?: unknown) => void;
}

/**
 * ロギングミドルウェア
 */
export class Logging implements Middleware {
    private startTime: number = 0;
    private options: LoggingOptions;

    constructor(options: LoggingOptions = {}) {
        this.options = {
            level: 'info',
            timestamp: true,
            logArgs: false,
            logResult: false,
            ...options,
        };
    }

    before(ctx: Context): void {
        this.startTime = performance.now();

        const message = this.options.timestamp
            ? `[${new Date().toISOString()}] Starting request`
            : 'Starting request';

        this.log(message, this.options.logArgs ? ctx.request : undefined);
    }

    after(ctx: Context, result: unknown): void {
        const duration = (performance.now() - this.startTime).toFixed(2);

        const message = this.options.timestamp
            ? `[${new Date().toISOString()}] Completed in ${duration}ms`
            : `Completed in ${duration}ms`;

        this.log(message, this.options.logResult ? result : undefined);
    }

    onError(ctx: Context, error: Error): void {
        const duration = (performance.now() - this.startTime).toFixed(2);

        const message = this.options.timestamp
            ? `[${new Date().toISOString()}] Failed after ${duration}ms: ${error.message}`
            : `Failed after ${duration}ms: ${error.message}`;

        this.error(message, error);
    }

    private log(message: string, data?: unknown): void {
        if (this.options.logger) {
            this.options.logger(message, data);
        } else {
            console.log(message, data !== undefined ? data : '');
        }
    }

    private error(message: string, error: Error): void {
        console.error(message, error);
    }
}

// ========================================
// Validation Middleware Factory
// ========================================

export interface ValidateOptions<T = unknown> {
    /** スキーマ */
    schema: T;
    /** エラーメッセージ */
    message?: string;
    /** 引数のインデックス（デフォルト: 0） */
    argIndex?: number;
}

/**
 * バリデーションミドルウェアを作成
 */
export function createValidateMiddleware<T>(options: ValidateOptions<T>): MiddlewareFn {
    const { schema, message = 'Validation failed', argIndex = 0 } = options;

    return async (ctx: Context) => {
        const args = ctx.request.args;
        const value = args[argIndex];

        // Zod-like schema
        if (typeof (schema as { parse?: Function }).parse === 'function') {
            try {
                const validated = (schema as { parse: Function }).parse(value);
                args[argIndex] = validated;
            } catch (error) {
                const err = new Error(message);
                err.name = 'ValidationError';
                (err as Error & { details?: unknown }).details = error;
                throw err;
            }
            return;
        }

        // Yup-like schema
        if (typeof (schema as { validate?: Function }).validate === 'function') {
            try {
                const validated = await (schema as { validate: Function }).validate(value);
                args[argIndex] = validated;
            } catch (error) {
                const err = new Error(message);
                err.name = 'ValidationError';
                (err as Error & { details?: unknown }).details = error;
                throw err;
            }
            return;
        }

        // Function validator
        if (typeof schema === 'function') {
            const result = await (schema as Function)(value);
            if (result !== true) {
                const err = new Error(typeof result === 'string' ? result : message);
                err.name = 'ValidationError';
                throw err;
            }
        }
    };
}

// ========================================
// Cache Middleware
// ========================================

interface CacheEntry {
    value: unknown;
    expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry>();

export interface CacheOptions {
    /** TTL（秒） */
    ttl: number;
    /** キャッシュキー生成関数 */
    keyGenerator?: (ctx: Context) => string;
}

/**
 * キャッシュミドルウェア
 */
export class Cache implements Middleware {
    private options: CacheOptions;

    constructor(options: CacheOptions) {
        this.options = options;
    }

    async before(ctx: Context): Promise<void> {
        const key = this.getKey(ctx);
        const cached = cacheStore.get(key);

        if (cached && cached.expiresAt > Date.now()) {
            // Store cached result in context to return later
            (ctx as Context & { __cachedResult?: unknown }).__cachedResult = cached.value;
        }
    }

    after(ctx: Context, result: unknown): unknown {
        // Return cached result if exists
        const cachedResult = (ctx as Context & { __cachedResult?: unknown }).__cachedResult;
        if (cachedResult !== undefined) {
            return cachedResult;
        }

        // Store new result in cache
        const key = this.getKey(ctx);
        cacheStore.set(key, {
            value: result,
            expiresAt: Date.now() + this.options.ttl * 1000,
        });

        return result;
    }

    private getKey(ctx: Context): string {
        if (this.options.keyGenerator) {
            return this.options.keyGenerator(ctx);
        }
        return JSON.stringify(ctx.request.args);
    }
}

/**
 * キャッシュをクリア
 */
export function clearCache(pattern?: string | RegExp): void {
    if (!pattern) {
        cacheStore.clear();
        return;
    }

    for (const key of cacheStore.keys()) {
        if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
            cacheStore.delete(key);
        }
    }
}

// ========================================
// Rate Limit Middleware
// ========================================

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
    /** 許可するリクエスト数 */
    count: number;
    /** 時間ウィンドウ（ミリ秒） */
    windowMs: number;
    /** キー生成関数 */
    keyGenerator?: (ctx: Context) => string;
    /** 制限超過時のメッセージ */
    message?: string;
}

/**
 * レート制限ミドルウェア
 */
export class RateLimit implements Middleware {
    private options: RateLimitOptions;

    constructor(options: RateLimitOptions) {
        this.options = {
            message: 'Too many requests, please try again later.',
            ...options,
        };
    }

    before(ctx: Context): void {
        const key = this.getKey(ctx);
        const now = Date.now();

        let entry = rateLimitStore.get(key);

        // Reset if window expired
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + this.options.windowMs };
            rateLimitStore.set(key, entry);
        }

        entry.count++;

        if (entry.count > this.options.count) {
            const error = new Error(this.options.message);
            error.name = 'RateLimitError';
            (error as Error & { retryAfter?: number }).retryAfter =
                Math.ceil((entry.resetAt - now) / 1000);
            throw error;
        }
    }

    private getKey(ctx: Context): string {
        if (this.options.keyGenerator) {
            return this.options.keyGenerator(ctx);
        }
        return ctx.user?.id ?? ctx.sessionId ?? 'anonymous';
    }
}

// ========================================
// Transaction Middleware
// ========================================

export interface TransactionOptions {
    /** トランザクション開始関数 */
    begin: () => Promise<unknown>;
    /** コミット関数 */
    commit: (tx: unknown) => Promise<void>;
    /** ロールバック関数 */
    rollback: (tx: unknown) => Promise<void>;
}

/**
 * トランザクションミドルウェア
 */
export class Transaction implements Middleware {
    private options: TransactionOptions;
    private transaction: unknown = null;

    constructor(options: TransactionOptions) {
        this.options = options;
    }

    async before(ctx: Context): Promise<void> {
        this.transaction = await this.options.begin();
        (ctx as Context & { transaction?: unknown }).transaction = this.transaction;
    }

    async after(): Promise<void> {
        if (this.transaction) {
            await this.options.commit(this.transaction);
        }
    }

    async onError(): Promise<void> {
        if (this.transaction) {
            await this.options.rollback(this.transaction);
        }
    }
}

// ========================================
// Auth Middleware Factory
// ========================================

export interface AuthOptions {
    /** 必要なロール */
    roles?: string[];
    /** カスタム認証チェック */
    check?: (ctx: Context) => boolean | Promise<boolean>;
    /** 未認証時のメッセージ */
    unauthenticatedMessage?: string;
    /** 権限不足時のメッセージ */
    forbiddenMessage?: string;
}

/**
 * 認証ミドルウェアを作成
 */
export function createAuthMiddleware(options: AuthOptions = {}): MiddlewareFn {
    const {
        roles = [],
        check,
        unauthenticatedMessage = 'Authentication required',
        forbiddenMessage = 'Access denied',
    } = options;

    return async (ctx: Context) => {
        // Custom check
        if (check) {
            const passed = await check(ctx);
            if (!passed) {
                const error = new Error(forbiddenMessage);
                error.name = 'ForbiddenError';
                throw error;
            }
            return;
        }

        // Check if authenticated
        if (!ctx.user) {
            const error = new Error(unauthenticatedMessage);
            error.name = 'UnauthorizedError';
            throw error;
        }

        // Check roles
        if (roles.length > 0) {
            const userRoles = ctx.user.roles || [];
            const hasRole = roles.some(role => userRoles.includes(role));

            if (!hasRole) {
                const error = new Error(forbiddenMessage);
                error.name = 'ForbiddenError';
                throw error;
            }
        }
    };
}
