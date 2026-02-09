/**
 * orz.ts DevTools - State Inspector
 *
 * ステート管理のデバッグツール
 */
// ========================================
// State Inspector
// ========================================
export class StateInspector {
    state;
    options;
    listeners = new Set();
    constructor(options = {}) {
        this.options = {
            enabled: true,
            maxHistorySize: 100,
            logToConsole: false,
            traceStack: false,
            ...options,
        };
        this.state = {
            stores: new Map(),
            signals: new Map(),
            history: [],
            maxHistorySize: this.options.maxHistorySize,
        };
        this.exposeToWindow();
    }
    exposeToWindow() {
        if (typeof window !== 'undefined') {
            window.__ORZ_DEVTOOLS__ = {
                inspector: this,
                getState: () => this.getSnapshot(),
                getHistory: () => this.getHistory(),
                clearHistory: () => this.clearHistory(),
            };
        }
    }
    /**
     * ストアを登録
     */
    registerStore(id, name, initialState) {
        if (!this.options.enabled)
            return;
        this.state.stores.set(id, {
            id,
            name,
            state: structuredClone(initialState),
            timestamp: Date.now(),
        });
        this.notifyListeners();
    }
    /**
     * ストア更新を記録
     */
    recordStoreChange(id, previousValue, newValue) {
        if (!this.options.enabled)
            return;
        const store = this.state.stores.get(id);
        if (!store)
            return;
        const change = {
            id: crypto.randomUUID(),
            type: 'store',
            targetId: id,
            targetName: store.name,
            previousValue: structuredClone(previousValue),
            newValue: structuredClone(newValue),
            timestamp: Date.now(),
            stack: this.options.traceStack ? new Error().stack : undefined,
        };
        this.addToHistory(change);
        store.state = structuredClone(newValue);
        store.timestamp = Date.now();
        if (this.options.logToConsole) {
            console.log(`[orz.ts] Store "${store.name}" updated:`, { previous: previousValue, new: newValue });
        }
        this.notifyListeners();
    }
    /**
     * シグナルを登録
     */
    registerSignal(id, name, value) {
        if (!this.options.enabled)
            return;
        this.state.signals.set(id, {
            id,
            name,
            value: structuredClone(value),
            dependencies: [],
            dependents: [],
            timestamp: Date.now(),
        });
        this.notifyListeners();
    }
    /**
     * シグナル更新を記録
     */
    recordSignalChange(id, previousValue, newValue) {
        if (!this.options.enabled)
            return;
        const signal = this.state.signals.get(id);
        if (!signal)
            return;
        const change = {
            id: crypto.randomUUID(),
            type: 'signal',
            targetId: id,
            targetName: signal.name,
            previousValue: structuredClone(previousValue),
            newValue: structuredClone(newValue),
            timestamp: Date.now(),
            stack: this.options.traceStack ? new Error().stack : undefined,
        };
        this.addToHistory(change);
        signal.value = structuredClone(newValue);
        signal.timestamp = Date.now();
        if (this.options.logToConsole) {
            console.log(`[orz.ts] Signal "${signal.name}" updated:`, { previous: previousValue, new: newValue });
        }
        this.notifyListeners();
    }
    /**
     * 依存関係を更新
     */
    updateDependencies(signalId, dependencies, dependents) {
        if (!this.options.enabled)
            return;
        const signal = this.state.signals.get(signalId);
        if (!signal)
            return;
        signal.dependencies = dependencies;
        signal.dependents = dependents;
        this.notifyListeners();
    }
    addToHistory(change) {
        this.state.history.push(change);
        // Trim history if needed
        while (this.state.history.length > this.state.maxHistorySize) {
            this.state.history.shift();
        }
    }
    /**
     * スナップショット取得
     */
    getSnapshot() {
        return {
            stores: [...this.state.stores.values()],
            signals: [...this.state.signals.values()],
        };
    }
    /**
     * 履歴取得
     */
    getHistory() {
        return [...this.state.history];
    }
    /**
     * 履歴クリア
     */
    clearHistory() {
        this.state.history = [];
        this.notifyListeners();
    }
    /**
     * リスナー登録
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    notifyListeners() {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }
}
// ========================================
// Global Instance
// ========================================
let globalInspector = null;
export function getStateInspector(options) {
    if (!globalInspector) {
        globalInspector = new StateInspector(options);
    }
    return globalInspector;
}
//# sourceMappingURL=state-inspector.js.map