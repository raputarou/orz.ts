/**
 * orz.ts Identity - DID (Decentralized Identifier)
 * 
 * W3C DID仕様に準拠したDID実装
 * did:key メソッドをサポート
 */

import {
    generateKeyPair,
    serializeKeyPair,
    deserializeKeyPair,
    uint8ArrayToBase64,
    base64ToUint8Array,
    multibaseEncode,
    multibaseDecode,
    type KeyPair,
    type SerializedKeyPair,
} from './crypto.js';

// ========================================
// Types
// ========================================

export interface DID {
    /** DID文字列 (did:key:z...) */
    id: string;
    /** DIDメソッド (key, web, etc.) */
    method: string;
    /** メソッド固有識別子 */
    identifier: string;
    /** キーペア */
    keyPair: KeyPair;
}

export interface DIDDocument {
    '@context': string[];
    id: string;
    verificationMethod: VerificationMethod[];
    authentication: string[];
    assertionMethod: string[];
    keyAgreement?: string[];
    capabilityInvocation?: string[];
    capabilityDelegation?: string[];
}

export interface VerificationMethod {
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase?: string;
    publicKeyBase64?: string;
}

export interface SerializedDID {
    id: string;
    method: string;
    identifier: string;
    keyPair: SerializedKeyPair;
}

export interface DIDResolutionResult {
    didDocument: DIDDocument | null;
    didResolutionMetadata: {
        contentType?: string;
        error?: string;
    };
    didDocumentMetadata: {
        created?: string;
        updated?: string;
    };
}

// ========================================
// Constants
// ========================================

/** Ed25519 Multicodec prefix */
const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

// ========================================
// DID:key Implementation
// ========================================

/**
 * 新しいDIDを生成 (did:key メソッド)
 */
export async function createDID(): Promise<DID> {
    const keyPair = await generateKeyPair();
    return createDIDFromKeyPair(keyPair);
}

/**
 * キーペアからDIDを作成
 */
export function createDIDFromKeyPair(keyPair: KeyPair): DID {
    // Multicodec prefix + public key
    const multicodecKey = new Uint8Array(ED25519_MULTICODEC.length + keyPair.publicKey.length);
    multicodecKey.set(ED25519_MULTICODEC);
    multicodecKey.set(keyPair.publicKey, ED25519_MULTICODEC.length);

    // Multibase encode (Base58btc)
    const identifier = multibaseEncode(multicodecKey);
    const id = `did:key:${identifier}`;

    return {
        id,
        method: 'key',
        identifier,
        keyPair,
    };
}

/**
 * DID文字列からDIDドキュメントを解決
 */
export function resolveDID(didString: string): DIDResolutionResult {
    try {
        const parts = didString.split(':');
        if (parts.length < 3 || parts[0] !== 'did') {
            throw new Error('Invalid DID format');
        }

        const method = parts[1];
        const identifier = parts.slice(2).join(':');

        if (method === 'key') {
            return resolveDIDKey(didString, identifier);
        }

        return {
            didDocument: null,
            didResolutionMetadata: { error: `Unsupported DID method: ${method}` },
            didDocumentMetadata: {},
        };
    } catch (error) {
        return {
            didDocument: null,
            didResolutionMetadata: { error: error instanceof Error ? error.message : 'Unknown error' },
            didDocumentMetadata: {},
        };
    }
}

/**
 * did:key を解決
 */
function resolveDIDKey(did: string, identifier: string): DIDResolutionResult {
    // Decode multibase
    const multicodecKey = multibaseDecode(identifier);

    // Extract public key (skip multicodec prefix)
    const publicKey = multicodecKey.slice(ED25519_MULTICODEC.length);
    const publicKeyMultibase = identifier;

    const document: DIDDocument = {
        '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/suites/ed25519-2020/v1',
        ],
        id: did,
        verificationMethod: [
            {
                id: `${did}#${identifier}`,
                type: 'Ed25519VerificationKey2020',
                controller: did,
                publicKeyMultibase,
            },
        ],
        authentication: [`${did}#${identifier}`],
        assertionMethod: [`${did}#${identifier}`],
        capabilityInvocation: [`${did}#${identifier}`],
        capabilityDelegation: [`${did}#${identifier}`],
    };

    return {
        didDocument: document,
        didResolutionMetadata: { contentType: 'application/did+json' },
        didDocumentMetadata: {
            created: new Date().toISOString(),
        },
    };
}

// ========================================
// Serialization
// ========================================

/**
 * DIDをシリアライズ
 */
export function serializeDID(did: DID): SerializedDID {
    return {
        id: did.id,
        method: did.method,
        identifier: did.identifier,
        keyPair: serializeKeyPair(did.keyPair),
    };
}

/**
 * シリアライズされたDIDを復元
 */
export function deserializeDID(serialized: SerializedDID): DID {
    return {
        id: serialized.id,
        method: serialized.method,
        identifier: serialized.identifier,
        keyPair: deserializeKeyPair(serialized.keyPair),
    };
}

// ========================================
// Storage
// ========================================

const DID_STORAGE_KEY = 'orz_did';

/**
 * DIDをローカルストレージに保存
 */
export function storeDID(did: DID): void {
    const serialized = serializeDID(did);
    localStorage.setItem(DID_STORAGE_KEY, JSON.stringify(serialized));
}

/**
 * ローカルストレージからDIDを読み込み
 */
export function loadDID(): DID | null {
    const stored = localStorage.getItem(DID_STORAGE_KEY);
    if (!stored) return null;

    try {
        const serialized = JSON.parse(stored) as SerializedDID;
        return deserializeDID(serialized);
    } catch {
        return null;
    }
}

/**
 * ローカルストレージからDIDを削除
 */
export function clearDID(): void {
    localStorage.removeItem(DID_STORAGE_KEY);
}

// ========================================
// DID Auth Challenge
// ========================================

export interface DIDAuthChallenge {
    challenge: string;
    domain: string;
    timestamp: number;
    expiresAt: number;
}

/**
 * 認証チャレンジを生成
 */
export function createAuthChallenge(domain: string, expiresInSeconds: number = 300): DIDAuthChallenge {
    const challenge = crypto.randomUUID();
    const timestamp = Date.now();

    return {
        challenge,
        domain,
        timestamp,
        expiresAt: timestamp + expiresInSeconds * 1000,
    };
}

/**
 * チャレンジが有効かチェック
 */
export function isValidChallenge(challenge: DIDAuthChallenge): boolean {
    return Date.now() < challenge.expiresAt;
}
