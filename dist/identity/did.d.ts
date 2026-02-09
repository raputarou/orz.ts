/**
 * orz.ts Identity - DID (Decentralized Identifier)
 *
 * W3C DID仕様に準拠したDID実装
 * did:key メソッドをサポート
 */
import { type KeyPair, type SerializedKeyPair } from './crypto.js';
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
/**
 * 新しいDIDを生成 (did:key メソッド)
 */
export declare function createDID(): Promise<DID>;
/**
 * キーペアからDIDを作成
 */
export declare function createDIDFromKeyPair(keyPair: KeyPair): DID;
/**
 * DID文字列からDIDドキュメントを解決
 */
export declare function resolveDID(didString: string): DIDResolutionResult;
/**
 * DIDをシリアライズ
 */
export declare function serializeDID(did: DID): SerializedDID;
/**
 * シリアライズされたDIDを復元
 */
export declare function deserializeDID(serialized: SerializedDID): DID;
/**
 * DIDをローカルストレージに保存
 */
export declare function storeDID(did: DID): void;
/**
 * ローカルストレージからDIDを読み込み
 */
export declare function loadDID(): DID | null;
/**
 * ローカルストレージからDIDを削除
 */
export declare function clearDID(): void;
export interface DIDAuthChallenge {
    challenge: string;
    domain: string;
    timestamp: number;
    expiresAt: number;
}
/**
 * 認証チャレンジを生成
 */
export declare function createAuthChallenge(domain: string, expiresInSeconds?: number): DIDAuthChallenge;
/**
 * チャレンジが有効かチェック
 */
export declare function isValidChallenge(challenge: DIDAuthChallenge): boolean;
//# sourceMappingURL=did.d.ts.map