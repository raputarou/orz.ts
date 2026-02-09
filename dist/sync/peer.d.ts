/**
 * orz.ts P2P - WebRTC Peer Connection
 *
 * P2P通信のためのWebRTC接続管理
 */
export interface PeerOptions {
    iceServers?: RTCIceServer[];
    dataChannelConfig?: RTCDataChannelInit;
    onMessage?: (peerId: string, data: unknown) => void;
    onConnect?: (peerId: string) => void;
    onDisconnect?: (peerId: string) => void;
    onError?: (peerId: string, error: Error) => void;
}
export interface SignalingMessage {
    type: 'offer' | 'answer' | 'candidate';
    from: string;
    to: string;
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
}
export interface PeerInfo {
    id: string;
    connection: RTCPeerConnection;
    dataChannel: RTCDataChannel | null;
    state: 'connecting' | 'connected' | 'disconnected';
}
export declare class PeerManager {
    private localId;
    private options;
    private peers;
    private signalingHandler;
    constructor(localId: string, options?: PeerOptions);
    /**
     * シグナリングハンドラを設定
     */
    onSignaling(handler: (message: SignalingMessage) => void): void;
    /**
     * ピアに接続開始（Offer送信側）
     */
    connect(peerId: string): Promise<void>;
    /**
     * シグナリングメッセージを処理
     */
    handleSignaling(message: SignalingMessage): Promise<void>;
    private handleOffer;
    private handleAnswer;
    private handleCandidate;
    private createConnection;
    private setupDataChannel;
    private sendSignaling;
    /**
     * ピアにメッセージ送信
     */
    send(peerId: string, data: unknown): void;
    /**
     * 全ピアにブロードキャスト
     */
    broadcast(data: unknown): void;
    /**
     * ピアとの接続を閉じる
     */
    disconnect(peerId: string): void;
    /**
     * 全接続を閉じる
     */
    disconnectAll(): void;
    /**
     * 接続中のピアIDを取得
     */
    getConnectedPeers(): string[];
    /**
     * 特定ピアの状態を取得
     */
    getPeerState(peerId: string): 'connecting' | 'connected' | 'disconnected' | null;
}
/**
 * PeerManagerを作成・取得
 */
export declare function createPeerManager(localId?: string, options?: PeerOptions): PeerManager;
/**
 * グローバルPeerManagerをリセット
 */
export declare function resetPeerManager(): void;
//# sourceMappingURL=peer.d.ts.map