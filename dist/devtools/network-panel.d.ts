/**
 * orz.ts DevTools - Network Panel
 *
 * ネットワークリクエストの監視・デバッグ
 */
export interface NetworkRequest {
    id: string;
    type: 'rpc' | 'fetch' | 'ws';
    method: string;
    url: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    status: 'pending' | 'success' | 'error';
    statusCode?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: unknown;
    responseBody?: unknown;
    error?: string;
    metadata?: Record<string, unknown>;
}
export interface NetworkPanelState {
    requests: NetworkRequest[];
    maxRequests: number;
    isRecording: boolean;
}
export interface NetworkPanelOptions {
    maxRequests?: number;
    logToConsole?: boolean;
    interceptFetch?: boolean;
}
export declare class NetworkPanel {
    private state;
    private options;
    private listeners;
    private originalFetch;
    constructor(options?: NetworkPanelOptions);
    private exposeToWindow;
    private interceptFetch;
    /**
     * リクエスト開始を記録
     */
    recordStart(data: Partial<NetworkRequest>): NetworkRequest;
    /**
     * リクエスト完了を記録
     */
    recordComplete(requestId: string, data: Partial<NetworkRequest>): void;
    /**
     * RPC呼び出しを記録
     */
    recordRPC(controller: string, methodName: string, params: unknown[]): NetworkRequest;
    /**
     * WebSocket メッセージを記録
     */
    recordWebSocket(url: string, message: unknown, direction: 'send' | 'receive'): NetworkRequest;
    private trimRequests;
    /**
     * リクエスト一覧取得
     */
    getRequests(): NetworkRequest[];
    /**
     * リクエスト検索
     */
    search(query: string): NetworkRequest[];
    /**
     * リクエストをクリア
     */
    clear(): void;
    /**
     * 記録開始
     */
    startRecording(): void;
    /**
     * 記録停止
     */
    stopRecording(): void;
    /**
     * リスナー登録
     */
    subscribe(listener: (requests: NetworkRequest[]) => void): () => void;
    private notifyListeners;
    /**
     * 破棄
     */
    dispose(): void;
}
export declare function getNetworkPanel(options?: NetworkPanelOptions): NetworkPanel;
//# sourceMappingURL=network-panel.d.ts.map