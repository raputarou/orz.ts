/**
 * orz.ts Identity - Cryptography
 *
 * Ed25519 キーペア生成・暗号操作
 * Web Crypto APIを使用した安全な実装
 */
export interface KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}
export interface SerializedKeyPair {
    publicKey: string;
    privateKey: string;
}
export interface SignatureResult {
    signature: Uint8Array;
    signatureBase64: string;
}
export interface VerifyResult {
    valid: boolean;
    publicKey: Uint8Array;
}
/**
 * Ed25519 キーペアを生成
 */
export declare function generateKeyPair(): Promise<KeyPair>;
/**
 * キーペアをシリアライズ (Base64)
 */
export declare function serializeKeyPair(keyPair: KeyPair): SerializedKeyPair;
/**
 * シリアライズされたキーペアを復元
 */
export declare function deserializeKeyPair(serialized: SerializedKeyPair): KeyPair;
/**
 * データに署名
 */
export declare function sign(data: Uint8Array | string, privateKey: Uint8Array): Promise<SignatureResult>;
/**
 * 署名を検証
 */
export declare function verify(data: Uint8Array | string, signature: Uint8Array | string, publicKey: Uint8Array): Promise<VerifyResult>;
/**
 * SHA-256 ハッシュ
 */
export declare function sha256(data: Uint8Array | string): Promise<Uint8Array>;
/**
 * SHA-512 ハッシュ
 */
export declare function sha512(data: Uint8Array | string): Promise<Uint8Array>;
/**
 * HMAC-SHA256
 */
export declare function hmacSha256(data: Uint8Array | string, key: Uint8Array | string): Promise<Uint8Array>;
/**
 * ランダムバイト生成
 */
export declare function randomBytes(length: number): Uint8Array;
/**
 * UUID v4 生成
 */
export declare function randomUUID(): string;
/**
 * Uint8Array to Base64
 */
export declare function uint8ArrayToBase64(bytes: Uint8Array): string;
/**
 * Base64 to Uint8Array
 */
export declare function base64ToUint8Array(base64: string): Uint8Array;
/**
 * Uint8Array to Hex
 */
export declare function uint8ArrayToHex(bytes: Uint8Array): string;
/**
 * Hex to Uint8Array
 */
export declare function hexToUint8Array(hex: string): Uint8Array;
/**
 * Multibase エンコード (Base58btc)
 */
export declare function multibaseEncode(bytes: Uint8Array): string;
/**
 * Multibase デコード
 */
export declare function multibaseDecode(encoded: string): Uint8Array;
//# sourceMappingURL=crypto.d.ts.map