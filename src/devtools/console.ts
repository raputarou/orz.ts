/**
 * orz.ts DevTools - Console
 * 
 * 開発者コンソール機能
 */

// ========================================
// Types
// ========================================

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

// ========================================
// Dev Console
// ========================================

export class DevConsole {
    private logs: LogEntry[] = [];
    private options: Required<ConsoleOptions>;
    private listeners: Set<(logs: LogEntry[]) => void> = new Set();

    constructor(options: ConsoleOptions = {}) {
        this.options = {
            maxLogs: 500,
            logToNativeConsole: true,
            captureErrors: true,
            ...options,
        };

        if (this.options.captureErrors) {
            this.captureGlobalErrors();
        }

        this.exposeToWindow();
    }

    private exposeToWindow(): void {
        if (typeof window !== 'undefined') {
            const devtools = (window as unknown as Record<string, unknown>).__ORZ_DEVTOOLS__ as Record<string, unknown> || {};
            devtools.console = {
                getLogs: () => this.getLogs(),
                clear: () => this.clear(),
                debug: (msg: string, data?: unknown) => this.debug(msg, data),
                info: (msg: string, data?: unknown) => this.info(msg, data),
                warn: (msg: string, data?: unknown) => this.warn(msg, data),
                error: (msg: string, data?: unknown) => this.error(msg, data),
            };
            (window as unknown as Record<string, unknown>).__ORZ_DEVTOOLS__ = devtools;
        }
    }

    private captureGlobalErrors(): void {
        if (typeof window === 'undefined') return;

        window.addEventListener('error', (event) => {
            this.addLog({
                level: 'error',
                message: event.message,
                data: { filename: event.filename, lineno: event.lineno, colno: event.colno },
                stack: event.error?.stack,
                source: 'global',
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.addLog({
                level: 'error',
                message: `Unhandled Promise Rejection: ${event.reason}`,
                data: event.reason,
                stack: event.reason?.stack,
                source: 'promise',
            });
        });
    }

    /**
     * デバッグログ
     */
    debug(message: string, data?: unknown, source?: string): void {
        this.log('debug', message, data, source);
    }

    /**
     * 情報ログ
     */
    info(message: string, data?: unknown, source?: string): void {
        this.log('info', message, data, source);
    }

    /**
     * 警告ログ
     */
    warn(message: string, data?: unknown, source?: string): void {
        this.log('warn', message, data, source);
    }

    /**
     * エラーログ
     */
    error(message: string, data?: unknown, source?: string): void {
        const stack = new Error().stack;
        this.addLog({ level: 'error', message, data, source, stack });
    }

    private log(level: LogLevel, message: string, data?: unknown, source?: string): void {
        this.addLog({ level, message, data, source });
    }

    private addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
        const logEntry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            ...entry,
        };

        this.logs.push(logEntry);

        // Trim old logs
        while (this.logs.length > this.options.maxLogs) {
            this.logs.shift();
        }

        // Log to native console
        if (this.options.logToNativeConsole) {
            const prefix = `[orz.ts${entry.source ? `:${entry.source}` : ''}]`;
            const nativeMethod = console[entry.level] || console.log;
            if (entry.data !== undefined) {
                nativeMethod(prefix, entry.message, entry.data);
            } else {
                nativeMethod(prefix, entry.message);
            }
        }

        this.notifyListeners();
    }

    /**
     * ログ取得
     */
    getLogs(level?: LogLevel): LogEntry[] {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        return [...this.logs];
    }

    /**
     * ログ検索
     */
    search(query: string): LogEntry[] {
        const lowerQuery = query.toLowerCase();
        return this.logs.filter(log =>
            log.message.toLowerCase().includes(lowerQuery) ||
            log.source?.toLowerCase().includes(lowerQuery) ||
            JSON.stringify(log.data).toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * ログクリア
     */
    clear(): void {
        this.logs = [];
        this.notifyListeners();
    }

    /**
     * リスナー登録
     */
    subscribe(listener: (logs: LogEntry[]) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        for (const listener of this.listeners) {
            listener(this.getLogs());
        }
    }

    /**
     * ログをJSONでエクスポート
     */
    export(): string {
        return JSON.stringify(this.logs, null, 2);
    }
}

// ========================================
// Global Instance
// ========================================

let globalDevConsole: DevConsole | null = null;

export function getDevConsole(options?: ConsoleOptions): DevConsole {
    if (!globalDevConsole) {
        globalDevConsole = new DevConsole(options);
    }
    return globalDevConsole;
}
