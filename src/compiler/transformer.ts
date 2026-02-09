/**
 * orz.ts Compiler - Code Transformer
 * 
 * コード変換
 * - デコレータウィービング
 * - RPC呼び出し置換
 * - サーバーサイドコード分離
 */

import * as ts from 'typescript';
import { ASTAnalyzer, type ControllerInfo, type RPCCallInfo } from './analyzer.js';

// ========================================
// Types
// ========================================

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

// ========================================
// Transformer
// ========================================

export class CodeTransformer {
    private analyzer: ASTAnalyzer;
    private options: TransformOptions;

    constructor(options: TransformOptions = {}) {
        this.analyzer = new ASTAnalyzer();
        this.options = {
            isDev: false,
            autoRPC: true,
            generateWorker: true,
            envPrefix: 'ORZ_',
            minify: false,
            ...options,
        };
    }

    /**
     * ソースコードを変換
     */
    transform(source: string, fileName: string): TransformResult {
        const analysis = this.analyzer.analyzeSource(source, fileName);

        let transformedCode = source;

        // 1. 環境変数を置換
        transformedCode = this.replaceEnvVariables(transformedCode);

        // 2. RPC呼び出しをラップ
        if (this.options.autoRPC) {
            transformedCode = this.wrapRPCCalls(transformedCode, analysis.rpcCalls);
        }

        // 3. コントローラーメソッドをRPCプロキシに変換
        if (analysis.controllers.length > 0) {
            transformedCode = this.transformControllers(transformedCode, analysis.controllers);
        }

        // 4. サーバーサイドコードを分離
        let workerCode: string | undefined;
        if (this.options.generateWorker && analysis.controllers.length > 0) {
            workerCode = this.generateWorkerCode(analysis.controllers);
        }

        return {
            code: transformedCode,
            map: null, // TODO: ソースマップ生成
            workerCode,
            controllers: analysis.controllers,
            rpcCalls: analysis.rpcCalls,
        };
    }

    /**
     * 環境変数を置換
     */
    private replaceEnvVariables(code: string): string {
        const envPrefix = this.options.envPrefix || 'ORZ_';

        // import.meta.env.ORZ_* を置換
        return code.replace(
            /import\.meta\.env\.(\w+)/g,
            (match, key) => {
                if (typeof process !== 'undefined' && process.env[key] !== undefined) {
                    return JSON.stringify(process.env[key]);
                }
                return match;
            }
        );
    }

    /**
     * RPC呼び出しをラップ
     */
    private wrapRPCCalls(code: string, rpcCalls: RPCCallInfo[]): string {
        // 既存のrpcCall()はそのまま
        // コントローラーへの直接呼び出しをrpcCall()に変換

        // UserController.getUser(id) → rpcCall('UserController.getUser', [id])
        // この変換は静的解析が必要

        return code;
    }

    /**
     * コントローラーをRPCプロキシに変換
     */
    private transformControllers(code: string, controllers: ControllerInfo[]): string {
        let transformed = code;

        for (const controller of controllers) {
            // コントローラークラスにRPC登録コードを追加
            const registrationCode = this.generateControllerRegistration(controller);

            // クラス定義の後に登録コードを追加
            const classPattern = new RegExp(
                `(class\\s+${controller.name}[^{]*\\{[\\s\\S]*?\\n\\})`,
                'm'
            );

            transformed = transformed.replace(classPattern, `$1\n\n${registrationCode}`);
        }

        return transformed;
    }

    /**
     * コントローラー登録コードを生成
     */
    private generateControllerRegistration(controller: ControllerInfo): string {
        const methods = controller.methods.map(m => {
            return `    '${m.name}': { method: '${m.httpMethod}', path: '${m.path}' }`;
        }).join(',\n');

        return `// Auto-generated RPC registration
controllerRegistry.register('${controller.name}', {
    class: ${controller.name},
    prefix: '${controller.prefix}',
    methods: {
${methods}
    }
});`;
    }

    /**
     * Workerコードを生成
     */
    private generateWorkerCode(controllers: ControllerInfo[]): string {
        const imports = controllers.map(c => {
            return `import { ${c.name} } from './${c.filePath.replace(/\.ts$/, '.js')}';`;
        }).join('\n');

        const registrations = controllers.map(c => {
            const methods = c.methods.map(m => `'${m.name}'`).join(', ');
            return `
// ${c.name}
const ${c.name.toLowerCase()} = new ${c.name}();
registerController('${c.name}', ${c.name.toLowerCase()}, [${methods}]);`;
        }).join('\n');

        return `/**
 * orz.ts Auto-generated Worker
 * DO NOT EDIT - This file is auto-generated by the orz compiler
 */

import { initializeWorkerHandler, registerController } from 'orz/core';

${imports}

// Controller registrations
${registrations}

// Initialize worker message handling
initializeWorkerHandler({
    onError: (error) => {
        console.error('[Worker] Error:', error);
    }
});

console.log('[Worker] Initialized');
`;
    }
}

// ========================================
// TypeScript Transformer Factory
// ========================================

/**
 * TypeScriptトランスフォーマーファクトリ
 * ts.Program と組み合わせて使用
 */
export function createOrzTransformer(options: TransformOptions = {}): ts.TransformerFactory<ts.SourceFile> {
    return (context: ts.TransformationContext) => {
        return (sourceFile: ts.SourceFile) => {
            const visitor = (node: ts.Node): ts.Node => {
                // デコレータ付きクラスを変換
                if (ts.isClassDeclaration(node)) {
                    return transformClass(node, context, options);
                }

                // rpcCall() を最適化
                if (ts.isCallExpression(node)) {
                    return transformCallExpression(node, context, options);
                }

                return ts.visitEachChild(node, visitor, context);
            };

            return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
        };
    };
}

/**
 * クラスを変換
 */
function transformClass(
    node: ts.ClassDeclaration,
    context: ts.TransformationContext,
    _options: TransformOptions
): ts.ClassDeclaration {
    // デコレータを処理
    const modifiers = node.modifiers;
    if (!modifiers) return node;

    const hasController = modifiers.some(m => {
        if (!ts.isDecorator(m)) return false;
        const expr = m.expression;
        if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
            return expr.expression.text === 'Controller';
        }
        if (ts.isIdentifier(expr)) {
            return expr.text === 'Controller';
        }
        return false;
    });

    if (!hasController) return node;

    // メソッドにメタデータ追加などの変換を行う
    // 現時点ではそのまま返す
    return node;
}

/**
 * 関数呼び出しを変換
 */
function transformCallExpression(
    node: ts.CallExpression,
    _context: ts.TransformationContext,
    _options: TransformOptions
): ts.CallExpression {
    // 開発モードではデバッグ情報を追加
    // 本番モードでは最適化

    return node;
}

// ========================================
// String-based Transformations
// ========================================

/**
 * コントローラーファイルを変換
 * (Viteプラグイン用のstring-based変換)
 */
export function transformControllerFile(source: string, id: string): TransformResult {
    const transformer = new CodeTransformer({
        isDev: true,
        autoRPC: true,
        generateWorker: false,
    });

    return transformer.transform(source, id);
}

/**
 * クライアントコードからサーバーサイドコードを除去
 */
export function stripServerSideCode(source: string): string {
    // @ServerSide デコレータが付いた関数を除去
    // 簡易的な正規表現ベースの実装

    let result = source;

    // @ServerSide 付きの関数宣言を除去
    result = result.replace(
        /@ServerSide\s*\n\s*(export\s+)?(async\s+)?function\s+\w+\s*\([^)]*\)\s*(\{[^}]*\}|\{[\s\S]*?\n\})/g,
        ''
    );

    // クリーンアップ（連続する空行を削減）
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
}

/**
 * サーバーサイドコードのみを抽出
 */
export function extractServerSideCode(source: string): string {
    const serverSideFunctions: string[] = [];

    // @ServerSide 付きの関数を抽出
    const regex = /@ServerSide\s*\n\s*(export\s+)?(async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(\{[\s\S]*?\n\})/g;
    let match;

    while ((match = regex.exec(source)) !== null) {
        serverSideFunctions.push(match[0]);
    }

    return serverSideFunctions.join('\n\n');
}

// Export singleton
export const transformer = new CodeTransformer();
