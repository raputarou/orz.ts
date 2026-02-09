/**
 * orz.ts DevTools - Console
 *
 * 開発者コンソール機能
 */
// ========================================
// Dev Console
// ========================================
export class DevConsole {
    logs = [];
    options;
    listeners = new Set();
    constructor(options = {}) {
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
    exposeToWindow() {
        if (typeof window !== 'undefined') {
            const devtools = window.__ORZ_DEVTOOLS__ || {};
            devtools.console = {
                getLogs: () => this.getLogs(),
                clear: () => this.clear(),
                debug: (msg, data) => this.debug(msg, data),
                info: (msg, data) => this.info(msg, data),
                warn: (msg, data) => this.warn(msg, data),
                error: (msg, data) => this.error(msg, data),
            };
            window.__ORZ_DEVTOOLS__ = devtools;
        }
    }
    captureGlobalErrors() {
        if (typeof window === 'undefined')
            return;
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
    debug(message, data, source) {
        this.log('debug', message, data, source);
    }
    /**
     * 情報ログ
     */
    info(message, data, source) {
        this.log('info', message, data, source);
    }
    /**
     * 警告ログ
     */
    warn(message, data, source) {
        this.log('warn', message, data, source);
    }
    /**
     * エラーログ
     */
    error(message, data, source) {
        const stack = new Error().stack;
        this.addLog({ level: 'error', message, data, source, stack });
    }
    log(level, message, data, source) {
        this.addLog({ level, message, data, source });
    }
    addLog(entry) {
        const logEntry = {
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
            }
            else {
                nativeMethod(prefix, entry.message);
            }
        }
        this.notifyListeners();
    }
    /**
     * ログ取得
     */
    getLogs(level) {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        return [...this.logs];
    }
    /**
     * ログ検索
     */
    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.logs.filter(log => log.message.toLowerCase().includes(lowerQuery) ||
            log.source?.toLowerCase().includes(lowerQuery) ||
            JSON.stringify(log.data).toLowerCase().includes(lowerQuery));
    }
    /**
     * ログクリア
     */
    clear() {
        this.logs = [];
        this.notifyListeners();
    }
    /**
     * リスナー登録
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    notifyListeners() {
        for (const listener of this.listeners) {
            listener(this.getLogs());
        }
    }
    /**
     * ログをJSONでエクスポート
     */
    export() {
        return JSON.stringify(this.logs, null, 2);
    }
}
// ========================================
// Global Instance
// ========================================
let globalDevConsole = null;
export function getDevConsole(options) {
    if (!globalDevConsole) {
        globalDevConsole = new DevConsole(options);
    }
    return globalDevConsole;
}
//# sourceMappingURL=console.js.map