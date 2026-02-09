/**
 * orz.ts Identity - DID (Decentralized Identifier)
 *
 * W3C DID仕様に準拠したDID実装
 * did:key メソッドをサポート
 */
import { generateKeyPair, serializeKeyPair, deserializeKeyPair, multibaseEncode, multibaseDecode, } from './crypto.js';
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
export async function createDID() {
    const keyPair = await generateKeyPair();
    return createDIDFromKeyPair(keyPair);
}
/**
 * キーペアからDIDを作成
 */
export function createDIDFromKeyPair(keyPair) {
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
export function resolveDID(didString) {
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
    }
    catch (error) {
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
function resolveDIDKey(did, identifier) {
    // Decode multibase
    const multicodecKey = multibaseDecode(identifier);
    // Extract public key (skip multicodec prefix)
    const publicKey = multicodecKey.slice(ED25519_MULTICODEC.length);
    const publicKeyMultibase = identifier;
    const document = {
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
export function serializeDID(did) {
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
export function deserializeDID(serialized) {
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
export function storeDID(did) {
    const serialized = serializeDID(did);
    localStorage.setItem(DID_STORAGE_KEY, JSON.stringify(serialized));
}
/**
 * ローカルストレージからDIDを読み込み
 */
export function loadDID() {
    const stored = localStorage.getItem(DID_STORAGE_KEY);
    if (!stored)
        return null;
    try {
        const serialized = JSON.parse(stored);
        return deserializeDID(serialized);
    }
    catch {
        return null;
    }
}
/**
 * ローカルストレージからDIDを削除
 */
export function clearDID() {
    localStorage.removeItem(DID_STORAGE_KEY);
}
/**
 * 認証チャレンジを生成
 */
export function createAuthChallenge(domain, expiresInSeconds = 300) {
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
export function isValidChallenge(challenge) {
    return Date.now() < challenge.expiresAt;
}
//# sourceMappingURL=did.js.map