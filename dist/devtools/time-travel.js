/**
 * orz.ts DevTools - Time Travel Debugging
 *
 * 状態の時間旅行デバッグ
 */
import { getStateInspector } from './state-inspector.js';
// ========================================
// Time Travel Debugger
// ========================================
export class TimeTravelDebugger {
    state;
    options;
    restoreCallbacks = new Map();
    autoSnapshotTimer = null;
    constructor(options = {}) {
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
    exposeToWindow() {
        if (typeof window !== 'undefined') {
            const devtools = window.__ORZ_DEVTOOLS__ || {};
            devtools.timeTravel = {
                snapshot: (label) => this.snapshot(label),
                getSnapshots: () => this.getSnapshots(),
                goTo: (index) => this.goTo(index),
                goBack: () => this.goBack(),
                goForward: () => this.goForward(),
                reset: () => this.reset(),
            };
            window.__ORZ_DEVTOOLS__ = devtools;
        }
    }
    /**
     * 復元コールバックを登録
     */
    registerRestoreCallback(id, callback) {
        this.restoreCallbacks.set(id, callback);
    }
    /**
     * スナップショット作成
     */
    snapshot(label) {
        const inspector = getStateInspector();
        const { stores, signals } = inspector.getSnapshot();
        const storeMap = new Map();
        for (const store of stores) {
            storeMap.set(store.id, structuredClone(store.state));
        }
        const signalMap = new Map();
        for (const signal of signals) {
            signalMap.set(signal.id, structuredClone(signal.value));
        }
        const snapshot = {
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
    goTo(index) {
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
    goBack() {
        if (this.state.currentIndex <= 0) {
            return false;
        }
        return this.goTo(this.state.currentIndex - 1);
    }
    /**
     * 1つ先のスナップショットに進む
     */
    goForward() {
        if (this.state.currentIndex >= this.state.snapshots.length - 1) {
            return false;
        }
        return this.goTo(this.state.currentIndex + 1);
    }
    restoreSnapshot(snapshot) {
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
    getSnapshots() {
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
    getCurrentIndex() {
        return this.state.currentIndex;
    }
    /**
     * リプレイ状態を確認
     */
    isReplaying() {
        return this.state.isReplaying;
    }
    /**
     * リプレイを終了（最新状態に戻る）
     */
    exitReplay() {
        if (!this.state.isReplaying)
            return false;
        this.state.isReplaying = false;
        return this.goTo(this.state.snapshots.length - 1);
    }
    /**
     * スナップショットをリセット
     */
    reset() {
        this.state.snapshots = [];
        this.state.currentIndex = -1;
        this.state.isReplaying = false;
    }
    /**
     * 自動スナップショット開始
     */
    startAutoSnapshot() {
        if (this.autoSnapshotTimer !== null)
            return;
        this.autoSnapshotTimer = window.setInterval(() => {
            this.snapshot('auto');
        }, this.options.snapshotInterval);
    }
    /**
     * 自動スナップショット停止
     */
    stopAutoSnapshot() {
        if (this.autoSnapshotTimer !== null) {
            window.clearInterval(this.autoSnapshotTimer);
            this.autoSnapshotTimer = null;
        }
    }
    /**
     * 破棄
     */
    dispose() {
        this.stopAutoSnapshot();
        this.reset();
        this.restoreCallbacks.clear();
    }
}
// ========================================
// Global Instance
// ========================================
let globalTimeTravelDebugger = null;
export function getTimeTravelDebugger(options) {
    if (!globalTimeTravelDebugger) {
        globalTimeTravelDebugger = new TimeTravelDebugger(options);
    }
    return globalTimeTravelDebugger;
}
//# sourceMappingURL=time-travel.js.map