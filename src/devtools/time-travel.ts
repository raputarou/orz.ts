/**
 * orz.ts DevTools - Time Travel Debugging
 * 
 * 状態の時間旅行デバッグ
 */

import { type StateChange, getStateInspector } from './state-inspector.js';

// ========================================
// Types
// ========================================

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
    snapshotInterval?: number; // ms
}

// ========================================
// Time Travel Debugger
// ========================================

export class TimeTravelDebugger {
    private state: TimeTravelState;
    private options: Required<TimeTravelOptions>;
    private restoreCallbacks: Map<string, (value: unknown) => void> = new Map();
    private autoSnapshotTimer: number | null = null;

    constructor(options: TimeTravelOptions = {}) {
        this.options = {
            maxSnapshots: 50,
            autoSnapshot: false,
            snapshotInterval: 5000,
            ...options,
        };

        this.state = {
            snapshots: [],
            currentIndex: -1,
            isReplaying: false,
            maxSnapshots: this.options.maxSnapshots,
        };

        if (this.options.autoSnapshot) {
            this.startAutoSnapshot();
        }

        this.exposeToWindow();
    }

    private exposeToWindow(): void {
        if (typeof window !== 'undefined') {
            const devtools = (window as unknown as Record<string, unknown>).__ORZ_DEVTOOLS__ as Record<string, unknown> || {};
            devtools.timeTravel = {
                snapshot: (label?: string) => this.snapshot(label),
                getSnapshots: () => this.getSnapshots(),
                goTo: (index: number) => this.goTo(index),
                goBack: () => this.goBack(),
                goForward: () => this.goForward(),
                reset: () => this.reset(),
            };
            (window as unknown as Record<string, unknown>).__ORZ_DEVTOOLS__ = devtools;
        }
    }

    /**
     * 復元コールバックを登録
     */
    registerRestoreCallback(id: string, callback: (value: unknown) => void): void {
        this.restoreCallbacks.set(id, callback);
    }

    /**
     * スナップショット作成
     */
    snapshot(label?: string): Snapshot {
        const inspector = getStateInspector();
        const { stores, signals } = inspector.getSnapshot();

        const storeMap = new Map<string, unknown>();
        for (const store of stores) {
            storeMap.set(store.id, structuredClone(store.state));
        }

        const signalMap = new Map<string, unknown>();
        for (const signal of signals) {
            signalMap.set(signal.id, structuredClone(signal.value));
        }

        const snapshot: Snapshot = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            label,
            state: { stores: storeMap, signals: signalMap },
        };

        // If we're in the middle of history, truncate forward history
        if (this.state.currentIndex < this.state.snapshots.length - 1) {
            this.state.snapshots = this.state.snapshots.slice(0, this.state.currentIndex + 1);
        }

        this.state.snapshots.push(snapshot);
        this.state.currentIndex = this.state.snapshots.length - 1;

        // Trim old snapshots
        while (this.state.snapshots.length > this.state.maxSnapshots) {
            this.state.snapshots.shift();
            this.state.currentIndex--;
        }

        return snapshot;
    }

    /**
     * 特定のスナップショットに移動
     */
    goTo(index: number): boolean {
        if (index < 0 || index >= this.state.snapshots.length) {
            return false;
        }

        this.state.currentIndex = index;
        this.state.isReplaying = true;

        const snapshot = this.state.snapshots[index];
        this.restoreSnapshot(snapshot);

        return true;
    }

    /**
     * 1つ前のスナップショットに戻る
     */
    goBack(): boolean {
        if (this.state.currentIndex <= 0) {
            return false;
        }
        return this.goTo(this.state.currentIndex - 1);
    }

    /**
     * 1つ先のスナップショットに進む
     */
    goForward(): boolean {
        if (this.state.currentIndex >= this.state.snapshots.length - 1) {
            return false;
        }
        return this.goTo(this.state.currentIndex + 1);
    }

    private restoreSnapshot(snapshot: Snapshot): void {
        // Restore stores
        for (const [id, value] of snapshot.state.stores) {
            const callback = this.restoreCallbacks.get(id);
            if (callback) {
                callback(structuredClone(value));
            }
        }

        // Restore signals
        for (const [id, value] of snapshot.state.signals) {
            const callback = this.restoreCallbacks.get(id);
            if (callback) {
                callback(structuredClone(value));
            }
        }
    }

    /**
     * スナップショット一覧取得
     */
    getSnapshots(): Array<{ index: number; id: string; timestamp: number; label?: string }> {
        return this.state.snapshots.map((s, i) => ({
            index: i,
            id: s.id,
            timestamp: s.timestamp,
            label: s.label,
        }));
    }

    /**
     * 現在のインデックス
     */
    getCurrentIndex(): number {
        return this.state.currentIndex;
    }

    /**
     * リプレイ状態を確認
     */
    isReplaying(): boolean {
        return this.state.isReplaying;
    }

    /**
     * リプレイを終了（最新状態に戻る）
     */
    exitReplay(): boolean {
        if (!this.state.isReplaying) return false;

        this.state.isReplaying = false;
        return this.goTo(this.state.snapshots.length - 1);
    }

    /**
     * スナップショットをリセット
     */
    reset(): void {
        this.state.snapshots = [];
        this.state.currentIndex = -1;
        this.state.isReplaying = false;
    }

    /**
     * 自動スナップショット開始
     */
    startAutoSnapshot(): void {
        if (this.autoSnapshotTimer !== null) return;

        this.autoSnapshotTimer = window.setInterval(() => {
            this.snapshot('auto');
        }, this.options.snapshotInterval);
    }

    /**
     * 自動スナップショット停止
     */
    stopAutoSnapshot(): void {
        if (this.autoSnapshotTimer !== null) {
            window.clearInterval(this.autoSnapshotTimer);
            this.autoSnapshotTimer = null;
        }
    }

    /**
     * 破棄
     */
    dispose(): void {
        this.stopAutoSnapshot();
        this.reset();
        this.restoreCallbacks.clear();
    }
}

// ========================================
// Global Instance
// ========================================

let globalTimeTravelDebugger: TimeTravelDebugger | null = null;

export function getTimeTravelDebugger(options?: TimeTravelOptions): TimeTravelDebugger {
    if (!globalTimeTravelDebugger) {
        globalTimeTravelDebugger = new TimeTravelDebugger(options);
    }
    return globalTimeTravelDebugger;
}
