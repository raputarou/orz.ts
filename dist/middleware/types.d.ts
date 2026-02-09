/**
 * orz.ts Middleware Types
 *
 * ミドルウェアシステムの型定義
 */
import type { Context } from '../core/context.js';
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
export type MiddlewareFn = (ctx: Context, metadata?: unknown) => void | Promise<void>;
/**
 * ミドルウェアの種類
 */
export type MiddlewareType = Middleware | MiddlewareFn | (new () => Middleware);
export interface MiddlewareChain {
    /** ミドルウェアを追加 */
    use(middleware: MiddlewareType): MiddlewareChain;
    /** 実行 */
    execute<T>(ctx: Context, handler: () => T | Promise<T>): Promise<T>;
}
/**
 * ミドルウェアチェーンを作成
 */
export declare function createMiddlewareChain(): MiddlewareChain;
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
//# sourceMappingURL=types.d.ts.map