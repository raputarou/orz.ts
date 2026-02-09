/**
 * orz.ts DevTools - Console
 *
 * 開発者コンソール機能
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogEntry {
    id: string;
    level: LogLevel;
    message: string;
    data?: unknown;
    timestamp: number;
    source?: string;
    stack?: string;
}
export interface ConsoleOptions {
    maxLogs?: number;
    logToNativeConsole?: boolean;
    captureErrors?: boolean;
}
export declare class DevConsole {
    private logs;
    private options;
    private listeners;
    constructor(options?: ConsoleOptions);
    private exposeToWindow;
    private captureGlobalErrors;
    /**
     * デバッグログ
     */
    debug(message: string, data?: unknown, source?: string): void;
    /**
     * 情報ログ
     */
    info(message: string, data?: unknown, source?: string): void;
    /**
     * 警告ログ
     */
    warn(message: string, data?: unknown, source?: string): void;
    /**
     * エラーログ
     */
    error(message: string, data?: unknown, source?: string): void;
    private log;
    private addLog;
    /**
     * ログ取得
     */
    getLogs(level?: LogLevel): LogEntry[];
    /**
     * ログ検索
     */
    search(query: string): LogEntry[];
    /**
     * ログクリア
     */
    clear(): void;
    /**
     * リスナー登録
     */
    subscribe(listener: (logs: LogEntry[]) => void): () => void;
    private notifyListeners;
    /**
     * ログをJSONでエクスポート
     */
    export(): string;
}
export declare function getDevConsole(options?: ConsoleOptions): DevConsole;
//# sourceMappingURL=console.d.ts.map