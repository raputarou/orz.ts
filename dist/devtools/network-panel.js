/**
 * orz.ts DevTools - Network Panel
 *
 * ネットワークリクエストの監視・デバッグ
 */
// ========================================
// Network Panel
// ========================================
export class NetworkPanel {
    state;
    options;
    listeners = new Set();
    originalFetch = null;
    constructor(options = {}) {
        this.options = {
            maxRequests: 200,
            logToConsole: false,
            interceptFetch: true,
            ...options,
        };
        this.state = {
            requests: [],
            maxRequests: this.options.maxRequests,
            isRecording: true,
        };
        if (this.options.interceptFetch) {
            this.interceptFetch();
        }
        this.exposeToWindow();
    }
    exposeToWindow() {
        if (typeof window !== 'undefined') {
            const devtools = window.__ORZ_DEVTOOLS__ || {};
            devtools.network = {
                getRequests: () => this.getRequests(),
                clear: () => this.clear(),
                startRecording: () => this.startRecording(),
                stopRecording: () => this.stopRecording(),
                search: (query) => this.search(query),
            };
            window.__ORZ_DEVTOOLS__ = devtools;
        }
    }
    interceptFetch() {
        if (typeof window === 'undefined')
            return;
        this.originalFetch = window.fetch;
        const self = this;
        window.fetch = async function (input, init) {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const method = init?.method || 'GET';
            const request = self.recordStart({
                type: 'fetch',
                method,
                url,
                requestHeaders: init?.headers,
                requestBody: init?.body,
            });
            try {
                const response = await self.originalFetch.call(window, input, init);
                // Clone response to read body without consuming it
                const clonedResponse = response.clone();
                let responseBody;
                try {
                    responseBody = await clonedResponse.json();
                }
                catch {
                    try {
                        responseBody = await clonedResponse.text();
                    }
                    catch {
                        responseBody = '[Unable to parse response]';
                    }
                }
                self.recordComplete(request.id, {
                    status: response.ok ? 'success' : 'error',
                    statusCode: response.status,
                    responseBody,
                });
                return response;
            }
            catch (error) {
                self.recordComplete(request.id, {
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                throw error;
            }
        };
    }
    /**
     * リクエスト開始を記録
     */
    recordStart(data) {
        if (!this.state.isRecording) {
            return { id: '', type: 'fetch', method: '', url: '', startTime: 0, status: 'pending' };
        }
        const request = {
            id: crypto.randomUUID(),
            type: data.type || 'fetch',
            method: data.method || 'GET',
            url: data.url || '',
            startTime: Date.now(),
            status: 'pending',
            requestHeaders: data.requestHeaders,
            requestBody: data.requestBody,
            metadata: data.metadata,
        };
        this.state.requests.push(request);
        this.trimRequests();
        this.notifyListeners();
        if (this.options.logToConsole) {
            console.log(`[orz.ts] → ${request.method} ${request.url}`);
        }
        return request;
    }
    /**
     * リクエスト完了を記録
     */
    recordComplete(requestId, data) {
        const request = this.state.requests.find(r => r.id === requestId);
        if (!request)
            return;
        request.endTime = Date.now();
        request.duration = request.endTime - request.startTime;
        request.status = data.status || 'success';
        request.statusCode = data.statusCode;
        request.responseHeaders = data.responseHeaders;
        request.responseBody = data.responseBody;
        request.error = data.error;
        if (this.options.logToConsole) {
            const statusSymbol = request.status === 'success' ? '✓' : '✗';
            console.log(`[orz.ts] ${statusSymbol} ${request.method} ${request.url} (${request.duration}ms)`);
        }
        this.notifyListeners();
    }
    /**
     * RPC呼び出しを記録
     */
    recordRPC(controller, methodName, params) {
        return this.recordStart({
            type: 'rpc',
            method: 'POST',
            url: `rpc://${controller}.${methodName}`,
            requestBody: { controller, method: methodName, params },
            metadata: { controller, method: methodName },
        });
    }
    /**
     * WebSocket メッセージを記録
     */
    recordWebSocket(url, message, direction) {
        const request = {
            id: crypto.randomUUID(),
            type: 'ws',
            method: direction === 'send' ? 'WS_SEND' : 'WS_RECEIVE',
            url,
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 0,
            status: 'success',
            requestBody: direction === 'send' ? message : undefined,
            responseBody: direction === 'receive' ? message : undefined,
        };
        if (this.state.isRecording) {
            this.state.requests.push(request);
            this.trimRequests();
            this.notifyListeners();
        }
        return request;
    }
    trimRequests() {
        while (this.state.requests.length > this.state.maxRequests) {
            this.state.requests.shift();
        }
    }
    /**
     * リクエスト一覧取得
     */
    getRequests() {
        return [...this.state.requests];
    }
    /**
     * リクエスト検索
     */
    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.state.requests.filter(r => r.url.toLowerCase().includes(lowerQuery) ||
            r.method.toLowerCase().includes(lowerQuery) ||
            r.type.toLowerCase().includes(lowerQuery));
    }
    /**
     * リクエストをクリア
     */
    clear() {
        this.state.requests = [];
        this.notifyListeners();
    }
    /**
     * 記録開始
     */
    startRecording() {
        this.state.isRecording = true;
    }
    /**
     * 記録停止
     */
    stopRecording() {
        this.state.isRecording = false;
    }
    /**
     * リスナー登録
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    notifyListeners() {
        const requests = this.getRequests();
        for (const listener of this.listeners) {
            listener(requests);
        }
    }
    /**
     * 破棄
     */
    dispose() {
        if (this.originalFetch && typeof window !== 'undefined') {
            window.fetch = this.originalFetch;
        }
        this.clear();
        this.listeners.clear();
    }
}
// ========================================
// Global Instance
// ========================================
let globalNetworkPanel = null;
export function getNetworkPanel(options) {
    if (!globalNetworkPanel) {
        globalNetworkPanel = new NetworkPanel(options);
    }
    return globalNetworkPanel;
}
//# sourceMappingURL=network-panel.js.map