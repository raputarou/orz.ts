/**
 * orz.ts DevTools - State Inspector
 * 
 * ステート管理のデバッグツール
 */

// ========================================
// Types
// ========================================

export interface InspectorState {
    stores: Map<string, StoreSnapshot>;
    signals: Map<string, SignalSnapshot>;
    history: StateChange[];
    maxHistorySize: number;
}

export interface StoreSnapshot {
    id: string;
    name: string;
    state: unknown;
    timestamp: number;
}

export interface SignalSnapshot {
    id: string;
    name: string;
    value: unknown;
    dependencies: string[];
    dependents: string[];
    timestamp: number;
}

export interface StateChange {
    id: string;
    type: 'store' | 'signal';
    targetId: string;
    targetName: string;
    previousValue: unknown;
    newValue: unknown;
    timestamp: number;
    stack?: string;
}

export interface DevToolsOptions {
    enabled?: boolean;
    maxHistorySize?: number;
    logToConsole?: boolean;
    traceStack?: boolean;
}

// ========================================
// State Inspector
// ========================================

export class StateInspector {
    private state: InspectorState;
    private options: Required<DevToolsOptions>;
    private listeners: Set<(state: InspectorState) => void> = new Set();

    constructor(options: DevToolsOptions = {}) {
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

    private exposeToWindow(): void {
        if (typeof window !== 'undefined') {
            (window as unknown as Record<string, unknown>).__ORZ_DEVTOOLS__ = {
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
    registerStore(id: string, name: string, initialState: unknown): void {
        if (!this.options.enabled) return;

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
    recordStoreChange(id: string, previousValue: unknown, newValue: unknown): void {
        if (!this.options.enabled) return;

        const store = this.state.stores.get(id);
        if (!store) return;

        const change: StateChange = {
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
    registerSignal(id: string, name: string, value: unknown): void {
        if (!this.options.enabled) return;

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
    recordSignalChange(id: string, previousValue: unknown, newValue: unknown): void {
        if (!this.options.enabled) return;

        const signal = this.state.signals.get(id);
        if (!signal) return;

        const change: StateChange = {
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
    updateDependencies(signalId: string, dependencies: string[], dependents: string[]): void {
        if (!this.options.enabled) return;

        const signal = this.state.signals.get(signalId);
        if (!signal) return;

        signal.dependencies = dependencies;
        signal.dependents = dependents;

        this.notifyListeners();
    }

    private addToHistory(change: StateChange): void {
        this.state.history.push(change);

        // Trim history if needed
        while (this.state.history.length > this.state.maxHistorySize) {
            this.state.history.shift();
        }
    }

    /**
     * スナップショット取得
     */
    getSnapshot(): { stores: StoreSnapshot[]; signals: SignalSnapshot[] } {
        return {
            stores: [...this.state.stores.values()],
            signals: [...this.state.signals.values()],
        };
    }

    /**
     * 履歴取得
     */
    getHistory(): StateChange[] {
        return [...this.state.history];
    }

    /**
     * 履歴クリア
     */
    clearHistory(): void {
        this.state.history = [];
        this.notifyListeners();
    }

    /**
     * リスナー登録
     */
    subscribe(listener: (state: InspectorState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }
}

// ========================================
// Global Instance
// ========================================

let globalInspector: StateInspector | null = null;

export function getStateInspector(options?: DevToolsOptions): StateInspector {
    if (!globalInspector) {
        globalInspector = new StateInspector(options);
    }
    return globalInspector;
}
