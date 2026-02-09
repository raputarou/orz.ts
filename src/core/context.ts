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

// ========================================
// Types
// ========================================

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

// ========================================
// Context Factory
// ========================================

/**
 * デフォルトのコンテキストを作成
 */
export function createContext(options: Partial<Context> = {}): Context {
    return {
        sessionId: options.sessionId,
        user: options.user ?? null,
        locale: options.locale ?? 'en',
        request: options.request ?? { args: [] },
        session: options.session,
        data: options.data ?? {},
    };
}

// ========================================
// Context Storage (Async Local Storage pattern)
// ========================================

let currentContext: Context | null = null;

/**
 * 現在のコンテキストを取得
 * コントローラー内から呼び出し可能
 */
export function getContext(): Context {
    if (!currentContext) {
        throw new Error('No active context. This function must be called within a request handler.');
    }
    return currentContext;
}

/**
 * コンテキストを設定して関数を実行
 */
export async function runWithContext<T>(
    context: Context,
    fn: () => T | Promise<T>
): Promise<T> {
    const previousContext = currentContext;
    currentContext = context;

    try {
        return await fn();
    } finally {
        currentContext = previousContext;
    }
}

/**
 * 現在のコンテキストが存在するかチェック
 */
export function hasContext(): boolean {
    return currentContext !== null;
}

// ========================================
// Context Helpers
// ========================================

/**
 * 現在のユーザーを取得
 */
export function getCurrentUser(): User | null {
    return currentContext?.user ?? null;
}

/**
 * ユーザーが認証済みかチェック
 */
export function isAuthenticated(): boolean {
    return currentContext?.user !== null;
}

/**
 * ユーザーがロールを持っているかチェック
 */
export function hasRole(role: string): boolean {
    const user = currentContext?.user;
    if (!user) return false;
    return user.roles.includes(role);
}

/**
 * ユーザーがいずれかのロールを持っているかチェック
 */
export function hasAnyRole(...roles: string[]): boolean {
    const user = currentContext?.user;
    if (!user) return false;
    return roles.some(role => user.roles.includes(role));
}

/**
 * ユーザーが全てのロールを持っているかチェック
 */
export function hasAllRoles(...roles: string[]): boolean {
    const user = currentContext?.user;
    if (!user) return false;
    return roles.every(role => user.roles.includes(role));
}

/**
 * 現在のロケールを取得
 */
export function getLocale(): string {
    return currentContext?.locale ?? 'en';
}

/**
 * セッションデータを取得
 */
export function getSessionData<T = unknown>(key: string): T | undefined {
    return currentContext?.session?.data[key] as T | undefined;
}
