/**
 * orz.ts Context
 *
 * リクエストコンテキストの定義と管理
 * - Context インターフェース
 * - セッション情報
 * - ユーザー情報
 * - ロケール
 */
// ========================================
// Context Factory
// ========================================
/**
 * デフォルトのコンテキストを作成
 */
export function createContext(options = {}) {
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
let currentContext = null;
/**
 * 現在のコンテキストを取得
 * コントローラー内から呼び出し可能
 */
export function getContext() {
    if (!currentContext) {
        throw new Error('No active context. This function must be called within a request handler.');
    }
    return currentContext;
}
/**
 * コンテキストを設定して関数を実行
 */
export async function runWithContext(context, fn) {
    const previousContext = currentContext;
    currentContext = context;
    try {
        return await fn();
    }
    finally {
        currentContext = previousContext;
    }
}
/**
 * 現在のコンテキストが存在するかチェック
 */
export function hasContext() {
    return currentContext !== null;
}
// ========================================
// Context Helpers
// ========================================
/**
 * 現在のユーザーを取得
 */
export function getCurrentUser() {
    return currentContext?.user ?? null;
}
/**
 * ユーザーが認証済みかチェック
 */
export function isAuthenticated() {
    return currentContext?.user !== null;
}
/**
 * ユーザーがロールを持っているかチェック
 */
export function hasRole(role) {
    const user = currentContext?.user;
    if (!user)
        return false;
    return user.roles.includes(role);
}
/**
 * ユーザーがいずれかのロールを持っているかチェック
 */
export function hasAnyRole(...roles) {
    const user = currentContext?.user;
    if (!user)
        return false;
    return roles.some(role => user.roles.includes(role));
}
/**
 * ユーザーが全てのロールを持っているかチェック
 */
export function hasAllRoles(...roles) {
    const user = currentContext?.user;
    if (!user)
        return false;
    return roles.every(role => user.roles.includes(role));
}
/**
 * 現在のロケールを取得
 */
export function getLocale() {
    return currentContext?.locale ?? 'en';
}
/**
 * セッションデータを取得
 */
export function getSessionData(key) {
    return currentContext?.session?.data[key];
}
//# sourceMappingURL=context.js.map