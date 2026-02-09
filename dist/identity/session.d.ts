/**
 * orz.ts Identity - Session Management
 *
 * DIDベースのセッション管理
 */
import { type DID, type DIDAuthChallenge } from './did.js';
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
    expiresIn?: number;
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
/**
 * セッション作成
 */
export declare function createSession(did: DID, options?: SessionOptions): Promise<Session>;
/**
 * セッション取得
 */
export declare function getSession(sessionId: string): Session | undefined;
/**
 * セッション更新
 */
export declare function updateSession(sessionId: string, data: Record<string, unknown>): Session | undefined;
/**
 * セッション削除
 */
export declare function deleteSession(sessionId: string): void;
/**
 * 全セッション削除
 */
export declare function clearAllSessions(): void;
/**
 * セッショントークン生成
 */
export declare function createSessionToken(did: DID, session: Session): Promise<SessionToken>;
/**
 * セッショントークン検証
 */
export declare function verifySessionToken(token: SessionToken): Promise<Session | null>;
/**
 * 認証チャレンジに署名してVerifiable Presentationを作成
 */
export declare function createAuthPresentation(did: DID, challenge: DIDAuthChallenge): Promise<VerifiablePresentation>;
/**
 * Verifiable Presentationを検証
 */
export declare function verifyAuthPresentation(presentation: VerifiablePresentation, challenge: DIDAuthChallenge): Promise<{
    valid: boolean;
    did: string | null;
    error?: string;
}>;
/**
 * 現在のセッションをセット
 */
export declare function setCurrentSession(sessionId: string): void;
/**
 * 現在のセッションを取得
 */
export declare function getCurrentSession(): Session | null;
/**
 * 現在のセッションをクリア
 */
export declare function clearCurrentSession(): void;
//# sourceMappingURL=session.d.ts.map