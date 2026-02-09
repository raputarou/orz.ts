/**
 * orz.ts P2P - WebRTC Peer Connection
 *
 * P2P通信のためのWebRTC接続管理
 */
// ========================================
// Default ICE Servers
// ========================================
const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];
// ========================================
// Peer Manager
// ========================================
export class PeerManager {
    localId;
    options;
    peers = new Map();
    signalingHandler = null;
    constructor(localId, options = {}) {
        this.localId = localId;
        this.options = {
            iceServers: DEFAULT_ICE_SERVERS,
            ...options,
        };
    }
    /**
     * シグナリングハンドラを設定
     */
    onSignaling(handler) {
        this.signalingHandler = handler;
    }
    /**
     * ピアに接続開始（Offer送信側）
     */
    async connect(peerId) {
        if (this.peers.has(peerId)) {
            throw new Error(`Already connected to peer: ${peerId}`);
        }
        const connection = this.createConnection(peerId);
        const dataChannel = connection.createDataChannel('orz-sync', this.options.dataChannelConfig);
        this.setupDataChannel(peerId, dataChannel);
        const peerInfo = {
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
    async handleSignaling(message) {
        if (message.to !== this.localId)
            return;
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
    async handleOffer(message) {
        const peerId = message.from;
        const connection = this.createConnection(peerId);
        const peerInfo = {
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
        await connection.setRemoteDescription(message.payload);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        this.sendSignaling({
            type: 'answer',
            from: this.localId,
            to: peerId,
            payload: answer,
        });
    }
    async handleAnswer(message) {
        const peer = this.peers.get(message.from);
        if (!peer)
            return;
        await peer.connection.setRemoteDescription(message.payload);
    }
    async handleCandidate(message) {
        const peer = this.peers.get(message.from);
        if (!peer)
            return;
        await peer.connection.addIceCandidate(message.payload);
    }
    createConnection(peerId) {
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
            if (!peer)
                return;
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
    setupDataChannel(peerId, channel) {
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
            }
            catch {
                this.options.onMessage?.(peerId, event.data);
            }
        };
        channel.onerror = (event) => {
            const error = new Error('DataChannel error');
            this.options.onError?.(peerId, error);
        };
    }
    sendSignaling(message) {
        if (this.signalingHandler) {
            this.signalingHandler(message);
        }
    }
    /**
     * ピアにメッセージ送信
     */
    send(peerId, data) {
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
    broadcast(data) {
        for (const [peerId, peer] of this.peers) {
            if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
                this.send(peerId, data);
            }
        }
    }
    /**
     * ピアとの接続を閉じる
     */
    disconnect(peerId) {
        const peer = this.peers.get(peerId);
        if (!peer)
            return;
        peer.dataChannel?.close();
        peer.connection.close();
        this.peers.delete(peerId);
    }
    /**
     * 全接続を閉じる
     */
    disconnectAll() {
        for (const peerId of this.peers.keys()) {
            this.disconnect(peerId);
        }
    }
    /**
     * 接続中のピアIDを取得
     */
    getConnectedPeers() {
        return [...this.peers.entries()]
            .filter(([_, peer]) => peer.state === 'connected')
            .map(([id]) => id);
    }
    /**
     * 特定ピアの状態を取得
     */
    getPeerState(peerId) {
        return this.peers.get(peerId)?.state ?? null;
    }
}
// ========================================
// Factory
// ========================================
let globalPeerManager = null;
/**
 * PeerManagerを作成・取得
 */
export function createPeerManager(localId, options) {
    if (!globalPeerManager) {
        const id = localId || crypto.randomUUID();
        globalPeerManager = new PeerManager(id, options);
    }
    return globalPeerManager;
}
/**
 * グローバルPeerManagerをリセット
 */
export function resetPeerManager() {
    if (globalPeerManager) {
        globalPeerManager.disconnectAll();
        globalPeerManager = null;
    }
}
//# sourceMappingURL=peer.js.map