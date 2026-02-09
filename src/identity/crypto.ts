/**
 * orz.ts Identity - Cryptography
 * 
 * Ed25519 キーペア生成・暗号操作
 * Web Crypto APIを使用した安全な実装
 */

// ========================================
// Types
// ========================================

export interface KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}

export interface SerializedKeyPair {
    publicKey: string;  // Base64
    privateKey: string; // Base64
}

export interface SignatureResult {
    signature: Uint8Array;
    signatureBase64: string;
}

export interface VerifyResult {
    valid: boolean;
    publicKey: Uint8Array;
}

// ========================================
// Constants
// ========================================

const ALGORITHM = 'Ed25519';

// ========================================
// Key Generation
// ========================================

/**
 * Ed25519 キーペアを生成
 */
export async function generateKeyPair(): Promise<KeyPair> {
    // Web Crypto APIを使用
    const keyPair = await crypto.subtle.generateKey(
        ALGORITHM,
        true, // extractable
        ['sign', 'verify']
    );

    // Export keys
    const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
        publicKey: new Uint8Array(publicKeyBuffer),
        privateKey: new Uint8Array(privateKeyBuffer),
    };
}

/**
 * キーペアをシリアライズ (Base64)
 */
export function serializeKeyPair(keyPair: KeyPair): SerializedKeyPair {
    return {
        publicKey: uint8ArrayToBase64(keyPair.publicKey),
        privateKey: uint8ArrayToBase64(keyPair.privateKey),
    };
}

/**
 * シリアライズされたキーペアを復元
 */
export function deserializeKeyPair(serialized: SerializedKeyPair): KeyPair {
    return {
        publicKey: base64ToUint8Array(serialized.publicKey),
        privateKey: base64ToUint8Array(serialized.privateKey),
    };
}

// ========================================
// Signing
// ========================================

/**
 * データに署名
 */
export async function sign(data: Uint8Array | string, privateKey: Uint8Array): Promise<SignatureResult> {
    const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

    // Import private key
    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        privateKey.buffer as ArrayBuffer,
        ALGORITHM,
        false,
        ['sign']
    );

    // Sign
    const signatureBuffer = await crypto.subtle.sign(
        ALGORITHM,
        cryptoKey,
        dataBytes.buffer as ArrayBuffer
    );

    const signature = new Uint8Array(signatureBuffer);

    return {
        signature,
        signatureBase64: uint8ArrayToBase64(signature),
    };
}

/**
 * 署名を検証
 */
export async function verify(
    data: Uint8Array | string,
    signature: Uint8Array | string,
    publicKey: Uint8Array
): Promise<VerifyResult> {
    const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const signatureBytes = typeof signature === 'string' ? base64ToUint8Array(signature) : signature;

    // Import public key
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        publicKey.buffer as ArrayBuffer,
        ALGORITHM,
        false,
        ['verify']
    );

    // Verify
    const valid = await crypto.subtle.verify(
        ALGORITHM,
        cryptoKey,
        signatureBytes.buffer as ArrayBuffer,
        dataBytes.buffer as ArrayBuffer
    );

    return { valid, publicKey };
}

// ========================================
// Hashing
// ========================================

/**
 * SHA-256 ハッシュ
 */
export async function sha256(data: Uint8Array | string): Promise<Uint8Array> {
    const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes.buffer as ArrayBuffer);
    return new Uint8Array(hashBuffer);
}

/**
 * SHA-512 ハッシュ
 */
export async function sha512(data: Uint8Array | string): Promise<Uint8Array> {
    const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-512', dataBytes.buffer as ArrayBuffer);
    return new Uint8Array(hashBuffer);
}

// ========================================
// HMAC
// ========================================

/**
 * HMAC-SHA256
 */
export async function hmacSha256(data: Uint8Array | string, key: Uint8Array | string): Promise<Uint8Array> {
    const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes.buffer as ArrayBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes.buffer as ArrayBuffer);
    return new Uint8Array(signatureBuffer);
}

// ========================================
// Random
// ========================================

/**
 * ランダムバイト生成
 */
export function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

/**
 * UUID v4 生成
 */
export function randomUUID(): string {
    return crypto.randomUUID();
}

// ========================================
// Encoding Utilities
// ========================================

/**
 * Uint8Array to Base64
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Base64 to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Uint8Array to Hex
 */
export function uint8ArrayToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Hex to Uint8Array
 */
export function hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}

/**
 * Multibase エンコード (Base58btc)
 */
export function multibaseEncode(bytes: Uint8Array): string {
    // Simplified Base58btc encoding
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    let num = BigInt(0);
    for (const byte of bytes) {
        num = num * BigInt(256) + BigInt(byte);
    }

    let encoded = '';
    while (num > 0) {
        encoded = ALPHABET[Number(num % BigInt(58))] + encoded;
        num = num / BigInt(58);
    }

    // Add leading zeros
    for (const byte of bytes) {
        if (byte === 0) {
            encoded = ALPHABET[0] + encoded;
        } else {
            break;
        }
    }

    return 'z' + encoded; // 'z' prefix for Base58btc in Multibase
}

/**
 * Multibase デコード
 */
export function multibaseDecode(encoded: string): Uint8Array {
    if (encoded[0] !== 'z') {
        throw new Error('Only Base58btc (z prefix) is supported');
    }

    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const input = encoded.slice(1);

    let num = BigInt(0);
    for (const char of input) {
        const index = ALPHABET.indexOf(char);
        if (index === -1) {
            throw new Error(`Invalid character: ${char}`);
        }
        num = num * BigInt(58) + BigInt(index);
    }

    const bytes: number[] = [];
    while (num > 0) {
        bytes.unshift(Number(num % BigInt(256)));
        num = num / BigInt(256);
    }

    // Add leading zeros
    for (const char of input) {
        if (char === ALPHABET[0]) {
            bytes.unshift(0);
        } else {
            break;
        }
    }

    return new Uint8Array(bytes);
}
