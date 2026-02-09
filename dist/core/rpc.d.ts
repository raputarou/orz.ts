/**
 * orz.ts RPC Communication Layer
 *
 * メインスレッドとWorker間のRPC通信を実装
 * - RPCRequest / RPCResponse インターフェース
 * - RPCClient (メインスレッド側)
 * - タイムアウト処理
 * - エラーハンドリング
 */
/**
 * JSONシリアライズ可能な値
 */
export type SerializableValue = string | number | boolean | null | SerializableValue[] | {
    [key: string]: SerializableValue;
};
/**
 * RPCリクエスト（メインスレッド → Worker）
 */
export interface RPCRequest {
    type: 'rpc-call';
    id: string;
    function: string;
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
/**
 * RPCタイムアウトエラー
 */
export declare class RPCTimeoutError extends Error {
    constructor(functionName: string, timeout: number);
}
/**
 * RPCリモートエラー
 */
export declare class RPCRemoteError extends Error {
    details?: SerializableValue;
    constructor(error: RPCError);
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
export declare class RPCClient {
    private worker;
    private pendingCalls;
    private options;
    private isInitialized;
    private messageQueue;
    constructor(options?: RPCClientOptions);
    /**
     * Workerを初期化
     */
    initialize(): Promise<void>;
    /**
     * RPC呼び出し
     *
     * @param functionName 関数名 (例: 'UserController.getUser')
     * @param args 引数配列
     * @returns Promise<結果>
     */
    call<T = SerializableValue>(functionName: string, args?: SerializableValue[]): Promise<T>;
    /**
     * メッセージハンドラ
     */
    private handleMessage;
    /**
     * エラーハンドラ
     */
    private handleError;
    /**
     * ユニークIDを生成
     */
    private generateId;
    /**
     * Workerを終了
     */
    terminate(): void;
    /**
     * 保留中の呼び出し数を取得
     */
    get pendingCount(): number;
}
/**
 * グローバルRPCクライアントを取得/設定
 */
export declare function getRPCClient(): RPCClient;
/**
 * グローバルRPCクライアントを初期化
 */
export declare function initializeRPC(options: RPCClientOptions): Promise<RPCClient>;
/**
 * RPC関数呼び出しのショートカット
 */
export declare function rpcCall<T = SerializableValue>(functionName: string, args?: SerializableValue[]): Promise<T>;
/**
 * 開発モード用HTTPクライアント
 * Workerを使わずにHTTPリクエストで通信
 */
export declare class HTTPRPCClient {
    private baseUrl;
    private debug;
    private contextProvider;
    constructor(options?: {
        baseUrl?: string;
        debug?: boolean;
        contextProvider?: () => RPCContext;
    });
    call<T = SerializableValue>(functionName: string, args?: SerializableValue[]): Promise<T>;
}
//# sourceMappingURL=rpc.d.ts.map