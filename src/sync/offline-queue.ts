/**
 * orz.ts Sync - Offline Queue
 * 
 * オフライン操作のキューイング
 */

// ========================================
// Types
// ========================================

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
    retryDelay?: number; // ms
    onProcess?: (operation: QueuedOperation) => Promise<boolean>;
    onComplete?: (operation: QueuedOperation) => void;
    onFail?: (operation: QueuedOperation) => void;
}

// ========================================
// Offline Queue
// ========================================

export class OfflineQueue {
    private queue: QueuedOperation[] = [];
    private options: Required<OfflineQueueOptions>;
    private isProcessing: boolean = false;
    private isOnline: boolean = true;

    constructor(options: OfflineQueueOptions = {}) {
        this.options = {
            storageKey: 'orz_offline_queue',
            maxRetries: 3,
            retryDelay: 1000,
            onProcess: async () => true,
            onComplete: () => { },
            onFail: () => { },
            ...options,
        };

        this.loadFromStorage();
        this.setupOnlineListener();
    }

    private setupOnlineListener(): void {
        if (typeof window !== 'undefined') {
            this.isOnline = navigator.onLine;

            window.addEventListener('online', () => {
                this.isOnline = true;
                this.processQueue();
            });

            window.addEventListener('offline', () => {
                this.isOnline = false;
            });
        }
    }

    /**
     * 操作をキューに追加
     */
    enqueue(type: string, payload: unknown): QueuedOperation {
        const operation: QueuedOperation = {
            id: crypto.randomUUID(),
            type,
            payload,
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: this.options.maxRetries,
            status: 'pending',
        };

        this.queue.push(operation);
        this.saveToStorage();

        if (this.isOnline) {
            this.processQueue();
        }

        return operation;
    }

    /**
     * キューを処理
     */
    async processQueue(): Promise<void> {
        if (this.isProcessing || !this.isOnline) return;

        this.isProcessing = true;

        try {
            while (this.queue.length > 0) {
                const operation = this.queue.find(op => op.status === 'pending');
                if (!operation) break;

                await this.processOperation(operation);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    private async processOperation(operation: QueuedOperation): Promise<void> {
        operation.status = 'processing';

        try {
            const success = await this.options.onProcess(operation);

            if (success) {
                operation.status = 'completed';
                this.options.onComplete(operation);
                this.removeFromQueue(operation.id);
            } else {
                throw new Error('Operation processing returned false');
            }
        } catch (error) {
            operation.retryCount++;

            if (operation.retryCount >= operation.maxRetries) {
                operation.status = 'failed';
                this.options.onFail(operation);
                this.removeFromQueue(operation.id);
            } else {
                operation.status = 'pending';
                // Exponential backoff
                await this.delay(this.options.retryDelay * Math.pow(2, operation.retryCount));
            }
        }

        this.saveToStorage();
    }

    private removeFromQueue(id: string): void {
        this.queue = this.queue.filter(op => op.id !== id);
        this.saveToStorage();
    }

    /**
     * キュー内の操作を取得
     */
    getQueue(): QueuedOperation[] {
        return [...this.queue];
    }

    /**
     * 保留中の操作数を取得
     */
    getPendingCount(): number {
        return this.queue.filter(op => op.status === 'pending').length;
    }

    /**
     * キューをクリア
     */
    clear(): void {
        this.queue = [];
        this.saveToStorage();
    }

    /**
     * 特定の操作をキャンセル
     */
    cancel(id: string): boolean {
        const index = this.queue.findIndex(op => op.id === id);
        if (index === -1) return false;

        this.queue.splice(index, 1);
        this.saveToStorage();
        return true;
    }

    /**
     * ストレージに保存
     */
    private saveToStorage(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            localStorage.setItem(this.options.storageKey, JSON.stringify(this.queue));
        } catch {
            // Storage full or not available
        }
    }

    /**
     * ストレージから読み込み
     */
    private loadFromStorage(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            const stored = localStorage.getItem(this.options.storageKey);
            if (stored) {
                this.queue = JSON.parse(stored);
                // Reset processing status
                this.queue.forEach(op => {
                    if (op.status === 'processing') {
                        op.status = 'pending';
                    }
                });
            }
        } catch {
            // Invalid data
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ========================================
// Factory
// ========================================

let globalOfflineQueue: OfflineQueue | null = null;

/**
 * OfflineQueueを作成・取得
 */
export function createOfflineQueue(options?: OfflineQueueOptions): OfflineQueue {
    if (!globalOfflineQueue) {
        globalOfflineQueue = new OfflineQueue(options);
    }
    return globalOfflineQueue;
}

/**
 * グローバルOfflineQueueをリセット
 */
export function resetOfflineQueue(): void {
    if (globalOfflineQueue) {
        globalOfflineQueue.clear();
    }
    globalOfflineQueue = null;
}
