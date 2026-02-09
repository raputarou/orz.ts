/**
 * orz.ts Sync - Offline Queue
 *
 * オフライン操作のキューイング
 */
export interface QueuedOperation {
    id: string;
    type: string;
    payload: unknown;
    timestamp: number;
    retryCount: number;
    maxRetries: number;
    status: 'pending' | 'processing' | 'failed' | 'completed';
}
export interface OfflineQueueOptions {
    storageKey?: string;
    maxRetries?: number;
    retryDelay?: number;
    onProcess?: (operation: QueuedOperation) => Promise<boolean>;
    onComplete?: (operation: QueuedOperation) => void;
    onFail?: (operation: QueuedOperation) => void;
}
export declare class OfflineQueue {
    private queue;
    private options;
    private isProcessing;
    private isOnline;
    constructor(options?: OfflineQueueOptions);
    private setupOnlineListener;
    /**
     * 操作をキューに追加
     */
    enqueue(type: string, payload: unknown): QueuedOperation;
    /**
     * キューを処理
     */
    processQueue(): Promise<void>;
    private processOperation;
    private removeFromQueue;
    /**
     * キュー内の操作を取得
     */
    getQueue(): QueuedOperation[];
    /**
     * 保留中の操作数を取得
     */
    getPendingCount(): number;
    /**
     * キューをクリア
     */
    clear(): void;
    /**
     * 特定の操作をキャンセル
     */
    cancel(id: string): boolean;
    /**
     * ストレージに保存
     */
    private saveToStorage;
    /**
     * ストレージから読み込み
     */
    private loadFromStorage;
    private delay;
}
/**
 * OfflineQueueを作成・取得
 */
export declare function createOfflineQueue(options?: OfflineQueueOptions): OfflineQueue;
/**
 * グローバルOfflineQueueをリセット
 */
export declare function resetOfflineQueue(): void;
//# sourceMappingURL=offline-queue.d.ts.map