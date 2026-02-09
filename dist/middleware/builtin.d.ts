/**
 * orz.ts Built-in Middlewares
 *
 * ビルトインミドルウェア実装
 */
import type { Context } from '../core/context.js';
import type { Middleware, MiddlewareFn } from './types.js';
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
export declare class Logging implements Middleware {
    private startTime;
    private options;
    constructor(options?: LoggingOptions);
    before(ctx: Context): void;
    after(ctx: Context, result: unknown): void;
    onError(ctx: Context, error: Error): void;
    private log;
    private error;
}
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
export declare function createValidateMiddleware<T>(options: ValidateOptions<T>): MiddlewareFn;
export interface CacheOptions {
    /** TTL（秒） */
    ttl: number;
    /** キャッシュキー生成関数 */
    keyGenerator?: (ctx: Context) => string;
}
/**
 * キャッシュミドルウェア
 */
export declare class Cache implements Middleware {
    private options;
    constructor(options: CacheOptions);
    before(ctx: Context): Promise<void>;
    after(ctx: Context, result: unknown): unknown;
    private getKey;
}
/**
 * キャッシュをクリア
 */
export declare function clearCache(pattern?: string | RegExp): void;
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
export declare class RateLimit implements Middleware {
    private options;
    constructor(options: RateLimitOptions);
    before(ctx: Context): void;
    private getKey;
}
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
export declare class Transaction implements Middleware {
    private options;
    private transaction;
    constructor(options: TransactionOptions);
    before(ctx: Context): Promise<void>;
    after(): Promise<void>;
    onError(): Promise<void>;
}
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
export declare function createAuthMiddleware(options?: AuthOptions): MiddlewareFn;
//# sourceMappingURL=builtin.d.ts.map