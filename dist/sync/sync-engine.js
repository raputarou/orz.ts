/**
 * orz.ts Sync - Sync Engine
 *
 * CRDTベースの同期エンジン
 * オフラインファーストの状態同期
 */
import { createVectorClock, incrementClock, mergeClock, isBefore, isConcurrent, } from './crdt.js';
// ========================================
// Default Conflict Resolver (LWW)
// ========================================
const lastWriterWins = (local, remote) => {
    return local.lastModified >= remote.lastModified ? local : remote;
};
// ========================================
// Sync Engine
// ========================================
export class SyncEngine {
    state;
    options;
    peerManager = null;
    pendingOperations = [];
    isOnline = true;
    constructor(options = {}) {
        this.options = {
            nodeId: crypto.randomUUID(),
            storage: 'memory',
            conflictResolver: lastWriterWins,
            ...options,
        };
        this.state = {
            nodeId: this.options.nodeId,
            documents: new Map(),
            operations: [],
            clock: createVectorClock(this.options.nodeId),
            lastSync: 0,
        };
        this.setupOnlineListener();
    }
    setupOnlineListener() {
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
    setPeerManager(peerManager) {
        this.peerManager = peerManager;
    }
    /**
     * ドキュメントを作成
     */
    create(id, data) {
        this.state.clock = incrementClock(this.state.clock, this.state.nodeId);
        const doc = {
            id,
            data,
            version: { ...this.state.clock },
            lastModified: Date.now(),
        };
        this.state.documents.set(id, doc);
        const operation = {
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
    update(id, data) {
        const existing = this.state.documents.get(id);
        if (!existing)
            return null;
        this.state.clock = incrementClock(this.state.clock, this.state.nodeId);
        const updated = {
            ...existing,
            data: { ...existing.data, ...data },
            version: { ...this.state.clock },
            lastModified: Date.now(),
        };
        this.state.documents.set(id, updated);
        const operation = {
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
    delete(id) {
        if (!this.state.documents.has(id))
            return false;
        this.state.clock = incrementClock(this.state.clock, this.state.nodeId);
        this.state.documents.delete(id);
        const operation = {
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
    get(id) {
        return this.state.documents.get(id);
    }
    /**
     * 全ドキュメント取得
     */
    getAll() {
        return [...this.state.documents.values()];
    }
    /**
     * リモート操作を受信
     */
    receiveOperations(operations) {
        for (const op of operations) {
            this.applyRemoteOperation(op);
        }
        this.options.onSync?.(this.getAll());
    }
    applyRemoteOperation(operation) {
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
                }
                else if (isConcurrent(existing.version, operation.version)) {
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
                        data: { ...existing.data, ...operation.data },
                        version: operation.version,
                        lastModified: operation.timestamp,
                    });
                }
                else if (existing && isConcurrent(existing.version, operation.version)) {
                    this.resolveConflict(existing, {
                        ...existing,
                        data: { ...existing.data, ...operation.data },
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
    resolveConflict(local, remote) {
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
    addOperation(operation) {
        this.state.operations.push(operation);
        if (this.isOnline && this.peerManager) {
            this.peerManager.broadcast({
                type: 'sync-operation',
                operations: [operation],
            });
        }
        else {
            this.pendingOperations.push(operation);
        }
    }
    flushPendingOperations() {
        if (!this.peerManager || this.pendingOperations.length === 0)
            return;
        this.peerManager.broadcast({
            type: 'sync-operations',
            operations: this.pendingOperations,
        });
        this.pendingOperations = [];
    }
    /**
     * 全状態をエクスポート
     */
    exportState() {
        return {
            ...this.state,
            documents: new Map(this.state.documents),
            operations: [...this.state.operations],
        };
    }
    /**
     * 状態をインポート
     */
    importState(state) {
        this.state = {
            ...state,
            documents: new Map(state.documents),
            operations: [...state.operations],
        };
    }
    /**
     * 同期リクエスト送信
     */
    requestSync() {
        if (!this.peerManager)
            return;
        this.peerManager.broadcast({
            type: 'sync-request',
            clock: this.state.clock,
            lastSync: this.state.lastSync,
        });
    }
    /**
     * 同期レスポンスを処理
     */
    handleSyncRequest(peerId, remoteClock) {
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
let globalSyncEngine = null;
/**
 * SyncEngineを作成・取得
 */
export function createSyncEngine(options) {
    if (!globalSyncEngine) {
        globalSyncEngine = new SyncEngine(options);
    }
    return globalSyncEngine;
}
/**
 * グローバルSyncEngineをリセット
 */
export function resetSyncEngine() {
    globalSyncEngine = null;
}
//# sourceMappingURL=sync-engine.js.map