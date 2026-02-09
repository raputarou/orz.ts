/**
 * orz.ts Sync - Sync Engine
 *
 * CRDTベースの同期エンジン
 * オフラインファーストの状態同期
 */
import { type VectorClock } from './crdt.js';
import { type PeerManager } from './peer.js';
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
export declare class SyncEngine {
    private state;
    private options;
    private peerManager;
    private pendingOperations;
    private isOnline;
    constructor(options?: SyncOptions);
    private setupOnlineListener;
    /**
     * PeerManagerを設定
     */
    setPeerManager(peerManager: PeerManager): void;
    /**
     * ドキュメントを作成
     */
    create<T>(id: string, data: T): SyncDocument<T>;
    /**
     * ドキュメントを更新
     */
    update<T>(id: string, data: Partial<T>): SyncDocument<T> | null;
    /**
     * ドキュメントを削除
     */
    delete(id: string): boolean;
    /**
     * ドキュメント取得
     */
    get<T>(id: string): SyncDocument<T> | undefined;
    /**
     * 全ドキュメント取得
     */
    getAll<T>(): SyncDocument<T>[];
    /**
     * リモート操作を受信
     */
    receiveOperations(operations: SyncOperation[]): void;
    private applyRemoteOperation;
    private resolveConflict;
    private addOperation;
    private flushPendingOperations;
    /**
     * 全状態をエクスポート
     */
    exportState(): SyncState;
    /**
     * 状態をインポート
     */
    importState(state: SyncState): void;
    /**
     * 同期リクエスト送信
     */
    requestSync(): void;
    /**
     * 同期レスポンスを処理
     */
    handleSyncRequest(peerId: string, remoteClock: VectorClock): void;
}
/**
 * SyncEngineを作成・取得
 */
export declare function createSyncEngine(options?: SyncOptions): SyncEngine;
/**
 * グローバルSyncEngineをリセット
 */
export declare function resetSyncEngine(): void;
//# sourceMappingURL=sync-engine.d.ts.map