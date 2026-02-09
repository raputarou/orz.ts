/**
 * orz.ts Identity - Session Management
 * 
 * DIDベースのセッション管理
 */

import {
    sign,
    verify,
    sha256,
    uint8ArrayToBase64,
    base64ToUint8Array,
} from './crypto.js';
import {
    type DID,
    loadDID,
    createAuthChallenge,
    isValidChallenge,
    type DIDAuthChallenge,
} from './did.js';

// ========================================
// Types
// ========================================

export interface Session {
    id: string;
    did: string;
    createdAt: number;
    expiresAt: number;
    data: Record<string, unknown>;
}

export interface SessionToken {
    sessionId: string;
    signature: string;
    publicKey: string;
}

export interface SessionOptions {
    expiresIn?: number; // seconds, default: 24 hours
    storage?: 'memory' | 'localStorage' | 'sessionStorage';
}

export interface VerifiablePresentation {
    '@context': string[];
    type: string[];
    holder: string;
    proof: {
        type: string;
        created: string;
        challenge: string;
        domain: string;
        proofPurpose: string;
        verificationMethod: string;
        proofValue: string;
    };
}

// ========================================
// Session Store
// ========================================

class SessionStore {
    private sessions: Map<string, Session> = new Map();
    private storageType: 'memory' | 'localStorage' | 'sessionStorage' = 'memory';
    private readonly SESSION_KEY = 'orz_session';

    setStorage(type: 'memory' | 'localStorage' | 'sessionStorage'): void {
        this.storageType = type;
        if (type !== 'memory') {
            this.loadFromStorage();
        }
    }

    get(sessionId: string): Session | undefined {
        this.cleanExpired();
        return this.sessions.get(sessionId);
    }

    set(session: Session): void {
        this.sessions.set(session.id, session);
        this.saveToStorage();
    }

    delete(sessionId: string): void {
        this.sessions.delete(sessionId);
        this.saveToStorage();
    }

    clear(): void {
        this.sessions.clear();
        this.saveToStorage();
    }

    private cleanExpired(): void {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (session.expiresAt < now) {
                this.sessions.delete(id);
            }
        }
    }

    private getStorage(): Storage | null {
        if (typeof window === 'undefined') return null;
        if (this.storageType === 'localStorage') return localStorage;
        if (this.storageType === 'sessionStorage') return sessionStorage;
        return null;
    }

    private saveToStorage(): void {
        const storage = this.getStorage();
        if (!storage) return;

        const sessionsArray = Array.from(this.sessions.entries());
        storage.setItem(this.SESSION_KEY, JSON.stringify(sessionsArray));
    }

    private loadFromStorage(): void {
        const storage = this.getStorage();
        if (!storage) return;

        const stored = storage.getItem(this.SESSION_KEY);
        if (!stored) return;

        try {
            const sessionsArray = JSON.parse(stored) as [string, Session][];
            this.sessions = new Map(sessionsArray);
            this.cleanExpired();
        } catch {
            // Invalid data
        }
    }
}

const sessionStore = new SessionStore();

// ========================================
// Session Management
// ========================================

/**
 * セッション作成
 */
export async function createSession(
    did: DID,
    options: SessionOptions = {}
): Promise<Session> {
    const expiresIn = options.expiresIn ?? 86400; // 24 hours

    if (options.storage) {
        sessionStore.setStorage(options.storage);
    }

    const session: Session = {
        id: crypto.randomUUID(),
        did: did.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + expiresIn * 1000,
        data: {},
    };

    sessionStore.set(session);
    return session;
}

/**
 * セッション取得
 */
export function getSession(sessionId: string): Session | undefined {
    return sessionStore.get(sessionId);
}

/**
 * セッション更新
 */
export function updateSession(sessionId: string, data: Record<string, unknown>): Session | undefined {
    const session = sessionStore.get(sessionId);
    if (!session) return undefined;

    session.data = { ...session.data, ...data };
    sessionStore.set(session);
    return session;
}

/**
 * セッション削除
 */
export function deleteSession(sessionId: string): void {
    sessionStore.delete(sessionId);
}

/**
 * 全セッション削除
 */
export function clearAllSessions(): void {
    sessionStore.clear();
}

// ========================================
// Session Token (JWT-like)
// ========================================

/**
 * セッショントークン生成
 */
export async function createSessionToken(did: DID, session: Session): Promise<SessionToken> {
    const payload = JSON.stringify({
        sessionId: session.id,
        did: session.did,
        exp: session.expiresAt,
    });

    const { signature, signatureBase64 } = await sign(payload, did.keyPair.privateKey);

    return {
        sessionId: session.id,
        signature: signatureBase64,
        publicKey: uint8ArrayToBase64(did.keyPair.publicKey),
    };
}

/**
 * セッショントークン検証
 */
export async function verifySessionToken(token: SessionToken): Promise<Session | null> {
    const session = sessionStore.get(token.sessionId);
    if (!session) return null;
    if (session.expiresAt < Date.now()) return null;

    const payload = JSON.stringify({
        sessionId: session.id,
        did: session.did,
        exp: session.expiresAt,
    });

    const publicKey = base64ToUint8Array(token.publicKey);
    const { valid } = await verify(payload, token.signature, publicKey);

    return valid ? session : null;
}

// ========================================
// DID Auth Flow
// ========================================

/**
 * 認証チャレンジに署名してVerifiable Presentationを作成
 */
export async function createAuthPresentation(
    did: DID,
    challenge: DIDAuthChallenge
): Promise<VerifiablePresentation> {
    const proofPayload = JSON.stringify({
        challenge: challenge.challenge,
        domain: challenge.domain,
        timestamp: challenge.timestamp,
    });

    const { signatureBase64 } = await sign(proofPayload, did.keyPair.privateKey);

    return {
        '@context': [
            'https://www.w3.org/2018/credentials/v1',
        ],
        type: ['VerifiablePresentation'],
        holder: did.id,
        proof: {
            type: 'Ed25519Signature2020',
            created: new Date().toISOString(),
            challenge: challenge.challenge,
            domain: challenge.domain,
            proofPurpose: 'authentication',
            verificationMethod: `${did.id}#${did.identifier}`,
            proofValue: signatureBase64,
        },
    };
}

/**
 * Verifiable Presentationを検証
 */
export async function verifyAuthPresentation(
    presentation: VerifiablePresentation,
    challenge: DIDAuthChallenge
): Promise<{ valid: boolean; did: string | null; error?: string }> {
    // Check challenge validity
    if (!isValidChallenge(challenge)) {
        return { valid: false, did: null, error: 'Challenge expired' };
    }

    // Verify challenge matches
    if (presentation.proof.challenge !== challenge.challenge) {
        return { valid: false, did: null, error: 'Challenge mismatch' };
    }

    if (presentation.proof.domain !== challenge.domain) {
        return { valid: false, did: null, error: 'Domain mismatch' };
    }

    // Extract public key from DID
    const did = presentation.holder;
    const identifier = did.split(':')[2];

    // Decode multibase to get public key
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const input = identifier.slice(1); // Skip 'z' prefix

    let num = BigInt(0);
    for (const char of input) {
        const index = ALPHABET.indexOf(char);
        if (index === -1) {
            return { valid: false, did: null, error: 'Invalid DID format' };
        }
        num = num * BigInt(58) + BigInt(index);
    }

    const bytes: number[] = [];
    while (num > 0) {
        bytes.unshift(Number(num % BigInt(256)));
        num = num / BigInt(256);
    }

    // Skip multicodec prefix (2 bytes for Ed25519)
    const publicKey = new Uint8Array(bytes.slice(2));

    // Verify signature
    const proofPayload = JSON.stringify({
        challenge: challenge.challenge,
        domain: challenge.domain,
        timestamp: challenge.timestamp,
    });

    try {
        const { valid } = await verify(proofPayload, presentation.proof.proofValue, publicKey);
        return { valid, did: valid ? did : null };
    } catch {
        return { valid: false, did: null, error: 'Signature verification failed' };
    }
}

// ========================================
// Current Session Helper
// ========================================

let currentSessionId: string | null = null;

/**
 * 現在のセッションをセット
 */
export function setCurrentSession(sessionId: string): void {
    currentSessionId = sessionId;
}

/**
 * 現在のセッションを取得
 */
export function getCurrentSession(): Session | null {
    if (!currentSessionId) return null;
    return sessionStore.get(currentSessionId) ?? null;
}

/**
 * 現在のセッションをクリア
 */
export function clearCurrentSession(): void {
    if (currentSessionId) {
        sessionStore.delete(currentSessionId);
    }
    currentSessionId = null;
}
