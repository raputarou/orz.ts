/**
 * orz.ts Context
 *
 * リクエストコンテキストの定義と管理
 * - Context インターフェース
 * - セッション情報
 * - ユーザー情報
 * - ロケール
 */
import type { SerializableValue } from './rpc.js';
/**
 * ユーザー情報
 */
export interface User {
    id: string;
    roles: string[];
    email?: string;
    name?: string;
    [key: string]: SerializableValue | undefined;
}
/**
 * セッション情報
 */
export interface Session {
    id: string;
    userId?: string;
    createdAt: number;
    expiresAt: number;
    data: Record<string, SerializableValue>;
}
/**
 * リクエスト情報
 */
export interface RequestInfo {
    args: SerializableValue[];
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    params?: Record<string, string>;
}
/**
 * コンテキスト
 * 全てのコントローラーメソッドに注入される
 */
export interface Context {
    /** セッションID */
    sessionId?: string;
    /** 認証済みユーザー */
    user: User | null;
    /** ロケール (ja, en, etc.) */
    locale: string;
    /** リクエスト情報 */
    request: RequestInfo;
    /** セッションデータ */
    session?: Session;
    /** カスタムデータ */
    data?: Record<string, unknown>;
}
/**
 * デフォルトのコンテキストを作成
 */
export declare function createContext(options?: Partial<Context>): Context;
/**
 * 現在のコンテキストを取得
 * コントローラー内から呼び出し可能
 */
export declare function getContext(): Context;
/**
 * コンテキストを設定して関数を実行
 */
export declare function runWithContext<T>(context: Context, fn: () => T | Promise<T>): Promise<T>;
/**
 * 現在のコンテキストが存在するかチェック
 */
export declare function hasContext(): boolean;
/**
 * 現在のユーザーを取得
 */
export declare function getCurrentUser(): User | null;
/**
 * ユーザーが認証済みかチェック
 */
export declare function isAuthenticated(): boolean;
/**
 * ユーザーがロールを持っているかチェック
 */
export declare function hasRole(role: string): boolean;
/**
 * ユーザーがいずれかのロールを持っているかチェック
 */
export declare function hasAnyRole(...roles: string[]): boolean;
/**
 * ユーザーが全てのロールを持っているかチェック
 */
export declare function hasAllRoles(...roles: string[]): boolean;
/**
 * 現在のロケールを取得
 */
export declare function getLocale(): string;
/**
 * セッションデータを取得
 */
export declare function getSessionData<T = unknown>(key: string): T | undefined;
//# sourceMappingURL=context.d.ts.map