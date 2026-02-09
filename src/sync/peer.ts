/**
 * orz.ts P2P - WebRTC Peer Connection
 * 
 * P2P通信のためのWebRTC接続管理
 */

// ========================================
// Types
// ========================================

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

// ========================================
// Default ICE Servers
// ========================================

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

// ========================================
// Peer Manager
// ========================================

export class PeerManager {
    private localId: string;
    private options: PeerOptions;
    private peers: Map<string, PeerInfo> = new Map();
    private signalingHandler: ((message: SignalingMessage) => void) | null = null;

    constructor(localId: string, options: PeerOptions = {}) {
        this.localId = localId;
        this.options = {
            iceServers: DEFAULT_ICE_SERVERS,
            ...options,
        };
    }

    /**
     * シグナリングハンドラを設定
     */
    onSignaling(handler: (message: SignalingMessage) => void): void {
        this.signalingHandler = handler;
    }

    /**
     * ピアに接続開始（Offer送信側）
     */
    async connect(peerId: string): Promise<void> {
        if (this.peers.has(peerId)) {
            throw new Error(`Already connected to peer: ${peerId}`);
        }

        const connection = this.createConnection(peerId);
        const dataChannel = connection.createDataChannel('orz-sync', this.options.dataChannelConfig);

        this.setupDataChannel(peerId, dataChannel);

        const peerInfo: PeerInfo = {
            id: peerId,
            connection,
            dataChannel,
            state: 'connecting',
        };
        this.peers.set(peerId, peerInfo);

        // Create and send offer
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);

        this.sendSignaling({
            type: 'offer',
            from: this.localId,
            to: peerId,
            payload: offer,
        });
    }

    /**
     * シグナリングメッセージを処理
     */
    async handleSignaling(message: SignalingMessage): Promise<void> {
        if (message.to !== this.localId) return;

        switch (message.type) {
            case 'offer':
                await this.handleOffer(message);
                break;
            case 'answer':
                await this.handleAnswer(message);
                break;
            case 'candidate':
                await this.handleCandidate(message);
                break;
        }
    }

    private async handleOffer(message: SignalingMessage): Promise<void> {
        const peerId = message.from;
        const connection = this.createConnection(peerId);

        const peerInfo: PeerInfo = {
            id: peerId,
            connection,
            dataChannel: null,
            state: 'connecting',
        };
        this.peers.set(peerId, peerInfo);

        // Handle incoming data channel
        connection.ondatachannel = (event) => {
            peerInfo.dataChannel = event.channel;
            this.setupDataChannel(peerId, event.channel);
        };

        await connection.setRemoteDescription(message.payload as RTCSessionDescriptionInit);

        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        this.sendSignaling({
            type: 'answer',
            from: this.localId,
            to: peerId,
            payload: answer,
        });
    }

    private async handleAnswer(message: SignalingMessage): Promise<void> {
        const peer = this.peers.get(message.from);
        if (!peer) return;

        await peer.connection.setRemoteDescription(message.payload as RTCSessionDescriptionInit);
    }

    private async handleCandidate(message: SignalingMessage): Promise<void> {
        const peer = this.peers.get(message.from);
        if (!peer) return;

        await peer.connection.addIceCandidate(message.payload as RTCIceCandidateInit);
    }

    private createConnection(peerId: string): RTCPeerConnection {
        const connection = new RTCPeerConnection({
            iceServers: this.options.iceServers,
        });

        connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignaling({
                    type: 'candidate',
                    from: this.localId,
                    to: peerId,
                    payload: event.candidate.toJSON(),
                });
            }
        };

        connection.onconnectionstatechange = () => {
            const peer = this.peers.get(peerId);
            if (!peer) return;

            switch (connection.connectionState) {
                case 'connected':
                    peer.state = 'connected';
                    this.options.onConnect?.(peerId);
                    break;
                case 'disconnected':
                case 'failed':
                case 'closed':
                    peer.state = 'disconnected';
                    this.options.onDisconnect?.(peerId);
                    break;
            }
        };

        return connection;
    }

    private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
        channel.onopen = () => {
            const peer = this.peers.get(peerId);
            if (peer) {
                peer.state = 'connected';
                this.options.onConnect?.(peerId);
            }
        };

        channel.onclose = () => {
            const peer = this.peers.get(peerId);
            if (peer) {
                peer.state = 'disconnected';
                this.options.onDisconnect?.(peerId);
            }
        };

        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.options.onMessage?.(peerId, data);
            } catch {
                this.options.onMessage?.(peerId, event.data);
            }
        };

        channel.onerror = (event) => {
            const error = new Error('DataChannel error');
            this.options.onError?.(peerId, error);
        };
    }

    private sendSignaling(message: SignalingMessage): void {
        if (this.signalingHandler) {
            this.signalingHandler(message);
        }
    }

    /**
     * ピアにメッセージ送信
     */
    send(peerId: string, data: unknown): void {
        const peer = this.peers.get(peerId);
        if (!peer || !peer.dataChannel || peer.dataChannel.readyState !== 'open') {
            throw new Error(`Not connected to peer: ${peerId}`);
        }

        const message = typeof data === 'string' ? data : JSON.stringify(data);
        peer.dataChannel.send(message);
    }

    /**
     * 全ピアにブロードキャスト
     */
    broadcast(data: unknown): void {
        for (const [peerId, peer] of this.peers) {
            if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
                this.send(peerId, data);
            }
        }
    }

    /**
     * ピアとの接続を閉じる
     */
    disconnect(peerId: string): void {
        const peer = this.peers.get(peerId);
        if (!peer) return;

        peer.dataChannel?.close();
        peer.connection.close();
        this.peers.delete(peerId);
    }

    /**
     * 全接続を閉じる
     */
    disconnectAll(): void {
        for (const peerId of this.peers.keys()) {
            this.disconnect(peerId);
        }
    }

    /**
     * 接続中のピアIDを取得
     */
    getConnectedPeers(): string[] {
        return [...this.peers.entries()]
            .filter(([_, peer]) => peer.state === 'connected')
            .map(([id]) => id);
    }

    /**
     * 特定ピアの状態を取得
     */
    getPeerState(peerId: string): 'connecting' | 'connected' | 'disconnected' | null {
        return this.peers.get(peerId)?.state ?? null;
    }
}

// ========================================
// Factory
// ========================================

let globalPeerManager: PeerManager | null = null;

/**
 * PeerManagerを作成・取得
 */
export function createPeerManager(localId?: string, options?: PeerOptions): PeerManager {
    if (!globalPeerManager) {
        const id = localId || crypto.randomUUID();
        globalPeerManager = new PeerManager(id, options);
    }
    return globalPeerManager;
}

/**
 * グローバルPeerManagerをリセット
 */
export function resetPeerManager(): void {
    if (globalPeerManager) {
        globalPeerManager.disconnectAll();
        globalPeerManager = null;
    }
}
