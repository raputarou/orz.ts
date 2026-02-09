/**
 * orz.ts DevTools - State Inspector
 *
 * ステート管理のデバッグツール
 */
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
export declare class StateInspector {
    private state;
    private options;
    private listeners;
    constructor(options?: DevToolsOptions);
    private exposeToWindow;
    /**
     * ストアを登録
     */
    registerStore(id: string, name: string, initialState: unknown): void;
    /**
     * ストア更新を記録
     */
    recordStoreChange(id: string, previousValue: unknown, newValue: unknown): void;
    /**
     * シグナルを登録
     */
    registerSignal(id: string, name: string, value: unknown): void;
    /**
     * シグナル更新を記録
     */
    recordSignalChange(id: string, previousValue: unknown, newValue: unknown): void;
    /**
     * 依存関係を更新
     */
    updateDependencies(signalId: string, dependencies: string[], dependents: string[]): void;
    private addToHistory;
    /**
     * スナップショット取得
     */
    getSnapshot(): {
        stores: StoreSnapshot[];
        signals: SignalSnapshot[];
    };
    /**
     * 履歴取得
     */
    getHistory(): StateChange[];
    /**
     * 履歴クリア
     */
    clearHistory(): void;
    /**
     * リスナー登録
     */
    subscribe(listener: (state: InspectorState) => void): () => void;
    private notifyListeners;
}
export declare function getStateInspector(options?: DevToolsOptions): StateInspector;
//# sourceMappingURL=state-inspector.d.ts.map