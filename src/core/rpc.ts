/**
 * orz.ts RPC Communication Layer
 * 
 * メインスレッドとWorker間のRPC通信を実装
 * - RPCRequest / RPCResponse インターフェース
 * - RPCClient (メインスレッド側)
 * - タイムアウト処理
 * - エラーハンドリング
 */

// ========================================
// Types
// ========================================

/**
 * JSONシリアライズ可能な値
 */
export type SerializableValue =
    | string
    | number
    | boolean
    | null
    | SerializableValue[]
    | { [key: string]: SerializableValue };

/**
 * RPCリクエスト（メインスレッド → Worker）
 */
export interface RPCRequest {
    type: 'rpc-call';
    id: string;
    function: string; // 'ControllerName.methodName'
    args: SerializableValue[];
    context?: RPCContext;
}

/**
 * RPCレスポンス（Worker → メインスレッド）
 */
export interface RPCResponse {
    type: 'rpc-response';
    id: string;
    result?: SerializableValue;
    error?: RPCError;
}

/**
 * RPCコンテキスト
 */
export interface RPCContext {
    sessionId?: string;
    userId?: string;
    locale?: string;
    [key: string]: SerializableValue | undefined;
}

/**
 * RPCエラー
 */
export interface RPCError {
    name: string;
    message: string;
    stack?: string;
    details?: SerializableValue;
}

/**
 * RPC設定オプション
 */
export interface RPCClientOptions {
    /** タイムアウト時間（ミリ秒） デフォルト: 30000 */
    timeout?: number;
    /** Worker URL */
    workerUrl?: string;
    /** カスタムWorkerインスタンス */
    worker?: Worker;
    /** デバッグモード */
    debug?: boolean;
    /** コンテキストプロバイダー */
    contextProvider?: () => RPCContext;
}

// ========================================
// Errors
// ========================================

/**
 * RPCタイムアウトエラー
 */
export class RPCTimeoutError extends Error {
    constructor(functionName: string, timeout: number) {
        super(`RPC call to '${functionName}' timed out after ${timeout}ms`);
        this.name = 'RPCTimeoutError';
    }
}

/**
 * RPCリモートエラー
 */
export class RPCRemoteError extends Error {
    public details?: SerializableValue;

    constructor(error: RPCError) {
        super(error.message);
        this.name = error.name || 'RPCRemoteError';
        this.stack = error.stack;
        this.details = error.details;
    }
}

// ========================================
// RPC Client
// ========================================

interface PendingCall {
    resolve: (value: SerializableValue) => void;
    reject: (error: Error) => void;
    functionName: string;
    timeoutId: ReturnType<typeof setTimeout>;
}

/**
 * RPCClient - メインスレッドからWorkerへのRPC呼び出しを管理
 * 
 * @example
 * ```ts
 * const rpc = new RPCClient({ workerUrl: '/worker.js' });
 * const user = await rpc.call('UserController.getUser', ['123']);
 * ```
 */
export class RPCClient {
    private worker: Worker | null = null;
    private pendingCalls = new Map<string, PendingCall>();
    private options: Required<Omit<RPCClientOptions, 'worker' | 'workerUrl'>> &
        Pick<RPCClientOptions, 'worker' | 'workerUrl'>;
    private isInitialized = false;
    private messageQueue: RPCRequest[] = [];

    constructor(options: RPCClientOptions = {}) {
        this.options = {
            timeout: options.timeout ?? 30000,
            debug: options.debug ?? false,
            contextProvider: options.contextProvider ?? (() => ({})),
            workerUrl: options.workerUrl,
            worker: options.worker,
        };
    }

    /**
     * Workerを初期化
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        if (this.options.worker) {
            this.worker = this.options.worker;
        } else if (this.options.workerUrl) {
            this.worker = new Worker(this.options.workerUrl, { type: 'module' });
        } else {
            throw new Error('RPCClient requires either worker or workerUrl option');
        }

        this.worker.addEventListener('message', this.handleMessage.bind(this));
        this.worker.addEventListener('error', this.handleError.bind(this));

        this.isInitialized = true;

        // Process queued messages
        for (const request of this.messageQueue) {
            this.worker.postMessage(request);
        }
        this.messageQueue = [];
    }

    /**
     * RPC呼び出し
     * 
     * @param functionName 関数名 (例: 'UserController.getUser')
     * @param args 引数配列
     * @returns Promise<結果>
     */
    async call<T = SerializableValue>(
        functionName: string,
        args: SerializableValue[] = []
    ): Promise<T> {
        const id = this.generateId();
        const context = this.options.contextProvider();

        const request: RPCRequest = {
            type: 'rpc-call',
            id,
            function: functionName,
            args,
            context,
        };

        if (this.options.debug) {
            console.log('[RPC] Calling:', functionName, args);
        }

        return new Promise<T>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (this.pendingCalls.has(id)) {
                    this.pendingCalls.delete(id);
                    reject(new RPCTimeoutError(functionName, this.options.timeout));
                }
            }, this.options.timeout);

            this.pendingCalls.set(id, {
                resolve: resolve as (value: SerializableValue) => void,
                reject,
                functionName,
                timeoutId,
            });

            if (this.worker && this.isInitialized) {
                this.worker.postMessage(request);
            } else {
                this.messageQueue.push(request);
                // Auto-initialize if not already
                this.initialize().catch(reject);
            }
        });
    }

    /**
     * メッセージハンドラ
     */
    private handleMessage(event: MessageEvent<RPCResponse>): void {
        const { id, result, error, type } = event.data;

        if (type !== 'rpc-response') return;

        const pending = this.pendingCalls.get(id);
        if (!pending) return;

        clearTimeout(pending.timeoutId);
        this.pendingCalls.delete(id);

        if (this.options.debug) {
            console.log('[RPC] Response:', pending.functionName, error ? 'ERROR' : 'OK', result ?? error);
        }

        if (error) {
            pending.reject(new RPCRemoteError(error));
        } else {
            pending.resolve(result ?? null);
        }
    }

    /**
     * エラーハンドラ
     */
    private handleError(event: ErrorEvent): void {
        console.error('[RPC] Worker error:', event.message);

        // Reject all pending calls
        for (const [id, pending] of this.pendingCalls) {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(`Worker error: ${event.message}`));
        }
        this.pendingCalls.clear();
    }

    /**
     * ユニークIDを生成
     */
    private generateId(): string {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    /**
     * Workerを終了
     */
    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }

        // Reject all pending calls
        for (const [id, pending] of this.pendingCalls) {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error('RPCClient terminated'));
        }
        this.pendingCalls.clear();
        this.isInitialized = false;
    }

    /**
     * 保留中の呼び出し数を取得
     */
    get pendingCount(): number {
        return this.pendingCalls.size;
    }
}

// ========================================
// Global RPC Instance
// ========================================

let globalRPCClient: RPCClient | null = null;

/**
 * グローバルRPCクライアントを取得/設定
 */
export function getRPCClient(): RPCClient {
    if (!globalRPCClient) {
        throw new Error('RPC client not initialized. Call initializeRPC() first.');
    }
    return globalRPCClient;
}

/**
 * グローバルRPCクライアントを初期化
 */
export async function initializeRPC(options: RPCClientOptions): Promise<RPCClient> {
    globalRPCClient = new RPCClient(options);
    await globalRPCClient.initialize();
    return globalRPCClient;
}

/**
 * RPC関数呼び出しのショートカット
 */
export async function rpcCall<T = SerializableValue>(
    functionName: string,
    args: SerializableValue[] = []
): Promise<T> {
    return getRPCClient().call<T>(functionName, args);
}

// ========================================
// Development Mode HTTP Client
// ========================================

/**
 * 開発モード用HTTPクライアント
 * Workerを使わずにHTTPリクエストで通信
 */
export class HTTPRPCClient {
    private baseUrl: string;
    private debug: boolean;
    private contextProvider: () => RPCContext;

    constructor(options: { baseUrl?: string; debug?: boolean; contextProvider?: () => RPCContext } = {}) {
        this.baseUrl = options.baseUrl ?? '';
        this.debug = options.debug ?? false;
        this.contextProvider = options.contextProvider ?? (() => ({}));
    }

    async call<T = SerializableValue>(
        functionName: string,
        args: SerializableValue[] = []
    ): Promise<T> {
        const [controller, method] = functionName.split('.');
        const url = `${this.baseUrl}/__orz_rpc__/${controller}/${method}`;

        if (this.debug) {
            console.log('[HTTP-RPC] Calling:', functionName, args);
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                args,
                context: this.contextProvider(),
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new RPCRemoteError({
                name: 'HTTPError',
                message: error.message ?? `HTTP ${response.status}`,
                details: error,
            });
        }

        const result = await response.json();

        if (this.debug) {
            console.log('[HTTP-RPC] Response:', functionName, result);
        }

        return result as T;
    }
}
