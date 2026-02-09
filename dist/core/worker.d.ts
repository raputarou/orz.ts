/**
 * orz.ts Worker Handler
 *
 * Worker側でのメッセージ処理を実装
 * - メッセージリスナー
 * - コントローラーディスパッチャー
 * - レスポンス送信
 */
import type { RPCRequest } from './rpc.js';
import type { Context } from './context.js';
export interface WorkerHandlerOptions {
    /** デバッグモード */
    debug?: boolean;
    /** エラーハンドラ */
    onError?: (error: Error, request: RPCRequest) => void;
    /** コンテキストファクトリ */
    createContext?: (request: RPCRequest) => Context;
}
/**
 * Workerメッセージハンドラを初期化
 *
 * @example
 * ```ts
 * // worker.ts
 * import { initializeWorkerHandler } from 'orz/core/worker';
 * import './controllers/UserController';
 *
 * initializeWorkerHandler({ debug: true });
 * ```
 */
export declare function initializeWorkerHandler(options?: WorkerHandlerOptions): void;
/**
 * 登録されたコントローラー一覧を取得
 */
export declare function getRegisteredControllers(): string[];
/**
 * コントローラーインスタンスをクリア（テスト用）
 */
export declare function clearControllerInstances(): void;
/**
 * 手動でコントローラーを登録
 */
export declare function registerController(name: string, instance: object): void;
//# sourceMappingURL=worker.d.ts.map