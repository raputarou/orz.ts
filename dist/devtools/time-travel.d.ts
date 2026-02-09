/**
 * orz.ts DevTools - Time Travel Debugging
 *
 * 状態の時間旅行デバッグ
 */
export interface TimeTravelState {
    snapshots: Snapshot[];
    currentIndex: number;
    isReplaying: boolean;
    maxSnapshots: number;
}
export interface Snapshot {
    id: string;
    timestamp: number;
    label?: string;
    state: {
        stores: Map<string, unknown>;
        signals: Map<string, unknown>;
    };
}
export interface TimeTravelOptions {
    maxSnapshots?: number;
    autoSnapshot?: boolean;
    snapshotInterval?: number;
}
export declare class TimeTravelDebugger {
    private state;
    private options;
    private restoreCallbacks;
    private autoSnapshotTimer;
    constructor(options?: TimeTravelOptions);
    private exposeToWindow;
    /**
     * 復元コールバックを登録
     */
    registerRestoreCallback(id: string, callback: (value: unknown) => void): void;
    /**
     * スナップショット作成
     */
    snapshot(label?: string): Snapshot;
    /**
     * 特定のスナップショットに移動
     */
    goTo(index: number): boolean;
    /**
     * 1つ前のスナップショットに戻る
     */
    goBack(): boolean;
    /**
     * 1つ先のスナップショットに進む
     */
    goForward(): boolean;
    private restoreSnapshot;
    /**
     * スナップショット一覧取得
     */
    getSnapshots(): Array<{
        index: number;
        id: string;
        timestamp: number;
        label?: string;
    }>;
    /**
     * 現在のインデックス
     */
    getCurrentIndex(): number;
    /**
     * リプレイ状態を確認
     */
    isReplaying(): boolean;
    /**
     * リプレイを終了（最新状態に戻る）
     */
    exitReplay(): boolean;
    /**
     * スナップショットをリセット
     */
    reset(): void;
    /**
     * 自動スナップショット開始
     */
    startAutoSnapshot(): void;
    /**
     * 自動スナップショット停止
     */
    stopAutoSnapshot(): void;
    /**
     * 破棄
     */
    dispose(): void;
}
export declare function getTimeTravelDebugger(options?: TimeTravelOptions): TimeTravelDebugger;
//# sourceMappingURL=time-travel.d.ts.map