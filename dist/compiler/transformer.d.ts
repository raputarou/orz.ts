/**
 * orz.ts Compiler - Code Transformer
 *
 * コード変換
 * - デコレータウィービング
 * - RPC呼び出し置換
 * - サーバーサイドコード分離
 */
import * as ts from 'typescript';
import { type ControllerInfo, type RPCCallInfo } from './analyzer.js';
export interface TransformOptions {
    /** 開発モード */
    isDev?: boolean;
    /** RPC自動置換 */
    autoRPC?: boolean;
    /** Worker生成 */
    generateWorker?: boolean;
    /** 環境変数プレフィックス */
    envPrefix?: string;
    /** ミニファイ */
    minify?: boolean;
}
export interface TransformResult {
    /** 変換後のコード */
    code: string;
    /** ソースマップ */
    map?: string | null;
    /** 生成されたWorkerコード */
    workerCode?: string;
    /** 使用されたコントローラー */
    controllers: ControllerInfo[];
    /** 検出されたRPC呼び出し */
    rpcCalls: RPCCallInfo[];
}
export declare class CodeTransformer {
    private analyzer;
    private options;
    constructor(options?: TransformOptions);
    /**
     * ソースコードを変換
     */
    transform(source: string, fileName: string): TransformResult;
    /**
     * 環境変数を置換
     */
    private replaceEnvVariables;
    /**
     * RPC呼び出しをラップ
     */
    private wrapRPCCalls;
    /**
     * コントローラーをRPCプロキシに変換
     */
    private transformControllers;
    /**
     * コントローラー登録コードを生成
     */
    private generateControllerRegistration;
    /**
     * Workerコードを生成
     */
    private generateWorkerCode;
}
/**
 * TypeScriptトランスフォーマーファクトリ
 * ts.Program と組み合わせて使用
 */
export declare function createOrzTransformer(options?: TransformOptions): ts.TransformerFactory<ts.SourceFile>;
/**
 * コントローラーファイルを変換
 * (Viteプラグイン用のstring-based変換)
 */
export declare function transformControllerFile(source: string, id: string): TransformResult;
/**
 * クライアントコードからサーバーサイドコードを除去
 */
export declare function stripServerSideCode(source: string): string;
/**
 * サーバーサイドコードのみを抽出
 */
export declare function extractServerSideCode(source: string): string;
export declare const transformer: CodeTransformer;
//# sourceMappingURL=transformer.d.ts.map