/**
 * orz.ts Sync - Sync Engine
 * 
 * CRDTベースの同期エンジン
 * オフラインファーストの状態同期
 */

import {
    type VectorClock,
    createVectorClock,
    incrementClock,
    mergeClock,
    isBefore,
    isConcurrent,
} from './crdt.js';
import { type PeerManager } from './peer.js';

// ========================================
// Types
// ========================================

export interface SyncDocument<T = unknown> {
    id: string;
    data: T;
    version: VectorClock;
    lastModified: number;
}

export interface SyncOperation {
    id: string;
    documentId: string;
    type: 'create' | 'update' | 'delete';
    data: unknown;
    version: VectorClock;
    timestamp: number;
    nodeId: string;
}

export interface SyncState {
    nodeId: string;
    documents: Map<string, SyncDocument>;
    operations: SyncOperation[];
    clock: VectorClock;
    lastSync: number;
}

export interface SyncOptions {
    nodeId?: string;
    storage?: 'memory' | 'indexeddb';
    conflictResolver?: ConflictResolver;
    onSync?: (documents: SyncDocument[]) => void;
    onConflict?: (conflict: ConflictInfo) => void;
}

export interface ConflictInfo {
    documentId: string;
    localVersion: SyncDocument;
    remoteVersion: SyncDocument;
    resolved: SyncDocument;
}

export type ConflictResolver = (local: SyncDocument, remote: SyncDocument) => SyncDocument;

// ========================================
// Default Conflict Resolver (LWW)
// ========================================

const lastWriterWins: ConflictResolver = (local, remote) => {
    return local.lastModified >= remote.lastModified ? local : remote;
};

// ========================================
// Sync Engine
// ========================================

export class SyncEngine {
    private state: SyncState;
    private options: SyncOptions;
    private peerManager: PeerManager | null = null;
    private pendingOperations: SyncOperation[] = [];
    private isOnline: boolean = true;

    constructor(options: SyncOptions = {}) {
        this.options = {
            nodeId: crypto.randomUUID(),
            storage: 'memory',
            conflictResolver: lastWriterWins,
            ...options,
        };

        this.state = {
            nodeId: this.options.nodeId!,
            documents: new Map(),
            operations: [],
            clock: createVectorClock(this.options.nodeId!),
            lastSync: 0,
        };

        this.setupOnlineListener();
    }

    private setupOnlineListener(): void {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                this.isOnline = true;
                this.flushPendingOperations();
            });
            window.addEventListener('offline', () => {
                this.isOnline = false;
            });
        }
    }

    /**
     * PeerManagerを設定
     */
    setPeerManager(peerManager: PeerManager): void {
        this.peerManager = peerManager;
    }

    /**
     * ドキュメントを作成
     */
    create<T>(id: string, data: T): SyncDocument<T> {
        this.state.clock = incrementClock(this.state.clock, this.state.nodeId);

        const doc: SyncDocument<T> = {
            id,
            data,
            version: { ...this.state.clock },
            lastModified: Date.now(),
        };

        this.state.documents.set(id, doc);

        const operation: SyncOperation = {
            id: crypto.randomUUID(),
            documentId: id,
            type: 'create',
            data,
            version: { ...this.state.clock },
            timestamp: Date.now(),
            nodeId: this.state.nodeId,
        };

        this.addOperation(operation);
        return doc;
    }

    /**
     * ドキュメントを更新
     */
    update<T>(id: string, data: Partial<T>): SyncDocument<T> | null {
        const existing = this.state.documents.get(id);
        if (!existing) return null;

        this.state.clock = incrementClock(this.state.clock, this.state.nodeId);

        const updated: SyncDocument<T> = {
            ...existing,
            data: { ...(existing.data as object), ...data } as T,
            version: { ...this.state.clock },
            lastModified: Date.now(),
        };

        this.state.documents.set(id, updated);

        const operation: SyncOperation = {
            id: crypto.randomUUID(),
            documentId: id,
            type: 'update',
            data,
            version: { ...this.state.clock },
            timestamp: Date.now(),
            nodeId: this.state.nodeId,
        };

        this.addOperation(operation);
        return updated;
    }

    /**
     * ドキュメントを削除
     */
    delete(id: string): boolean {
        if (!this.state.documents.has(id)) return false;

        this.state.clock = incrementClock(this.state.clock, this.state.nodeId);

        this.state.documents.delete(id);

        const operation: SyncOperation = {
            id: crypto.randomUUID(),
            documentId: id,
            type: 'delete',
            data: null,
            version: { ...this.state.clock },
            timestamp: Date.now(),
            nodeId: this.state.nodeId,
        };

        this.addOperation(operation);
        return true;
    }

    /**
     * ドキュメント取得
     */
    get<T>(id: string): SyncDocument<T> | undefined {
        return this.state.documents.get(id) as SyncDocument<T> | undefined;
    }

    /**
     * 全ドキュメント取得
     */
    getAll<T>(): SyncDocument<T>[] {
        return [...this.state.documents.values()] as SyncDocument<T>[];
    }

    /**
     * リモート操作を受信
     */
    receiveOperations(operations: SyncOperation[]): void {
        for (const op of operations) {
            this.applyRemoteOperation(op);
        }

        this.options.onSync?.(this.getAll());
    }

    private applyRemoteOperation(operation: SyncOperation): void {
        const existing = this.state.documents.get(operation.documentId);

        switch (operation.type) {
            case 'create':
                if (!existing || isBefore(existing.version, operation.version)) {
                    this.state.documents.set(operation.documentId, {
                        id: operation.documentId,
                        data: operation.data,
                        version: operation.version,
                        lastModified: operation.timestamp,
                    });
                } else if (isConcurrent(existing.version, operation.version)) {
                    this.resolveConflict(existing, {
                        id: operation.documentId,
                        data: operation.data,
                        version: operation.version,
                        lastModified: operation.timestamp,
                    });
                }
                break;

            case 'update':
                if (existing && isBefore(existing.version, operation.version)) {
                    this.state.documents.set(operation.documentId, {
                        ...existing,
                        data: { ...(existing.data as object), ...(operation.data as object) },
                        version: operation.version,
                        lastModified: operation.timestamp,
                    });
                } else if (existing && isConcurrent(existing.version, operation.version)) {
                    this.resolveConflict(existing, {
                        ...existing,
                        data: { ...(existing.data as object), ...(operation.data as object) },
                        version: operation.version,
                        lastModified: operation.timestamp,
                    });
                }
                break;

            case 'delete':
                if (existing && !isBefore(operation.version, existing.version)) {
                    this.state.documents.delete(operation.documentId);
                }
                break;
        }

        // Merge vector clock
        this.state.clock = mergeClock(this.state.clock, operation.version);
    }

    private resolveConflict(local: SyncDocument, remote: SyncDocument): void {
        const resolver = this.options.conflictResolver || lastWriterWins;
        const resolved = resolver(local, remote);

        this.state.documents.set(resolved.id, resolved);

        this.options.onConflict?.({
            documentId: resolved.id,
            localVersion: local,
            remoteVersion: remote,
            resolved,
        });
    }

    private addOperation(operation: SyncOperation): void {
        this.state.operations.push(operation);

        if (this.isOnline && this.peerManager) {
            this.peerManager.broadcast({
                type: 'sync-operation',
                operations: [operation],
            });
        } else {
            this.pendingOperations.push(operation);
        }
    }

    private flushPendingOperations(): void {
        if (!this.peerManager || this.pendingOperations.length === 0) return;

        this.peerManager.broadcast({
            type: 'sync-operations',
            operations: this.pendingOperations,
        });

        this.pendingOperations = [];
    }

    /**
     * 全状態をエクスポート
     */
    exportState(): SyncState {
        return {
            ...this.state,
            documents: new Map(this.state.documents),
            operations: [...this.state.operations],
        };
    }

    /**
     * 状態をインポート
     */
    importState(state: SyncState): void {
        this.state = {
            ...state,
            documents: new Map(state.documents),
            operations: [...state.operations],
        };
    }

    /**
     * 同期リクエスト送信
     */
    requestSync(): void {
        if (!this.peerManager) return;

        this.peerManager.broadcast({
            type: 'sync-request',
            clock: this.state.clock,
            lastSync: this.state.lastSync,
        });
    }

    /**
     * 同期レスポンスを処理
     */
    handleSyncRequest(peerId: string, remoteClock: VectorClock): void {
        // Find operations that the peer hasn't seen
        const opsToSend = this.state.operations.filter(op => {
            return !isBefore(op.version, remoteClock);
        });

        if (this.peerManager && opsToSend.length > 0) {
            this.peerManager.send(peerId, {
                type: 'sync-response',
                operations: opsToSend,
            });
        }
    }
}

// ========================================
// Factory
// ========================================

let globalSyncEngine: SyncEngine | null = null;

/**
 * SyncEngineを作成・取得
 */
export function createSyncEngine(options?: SyncOptions): SyncEngine {
    if (!globalSyncEngine) {
        globalSyncEngine = new SyncEngine(options);
    }
    return globalSyncEngine;
}

/**
 * グローバルSyncEngineをリセット
 */
export function resetSyncEngine(): void {
    globalSyncEngine = null;
}
