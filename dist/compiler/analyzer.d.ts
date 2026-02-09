/**
 * orz.ts Compiler - AST Analyzer
 *
 * TypeScript AST解析
 * - コントローラー検出
 * - サーバーサイド関数検出
 * - RPC呼び出し検出
 */
import * as ts from 'typescript';
export interface ControllerInfo {
    name: string;
    filePath: string;
    prefix: string;
    methods: MethodInfo[];
    decorators: string[];
    isServerSide: boolean;
}
export interface MethodInfo {
    name: string;
    httpMethod: string;
    path: string;
    decorators: DecoratorInfo[];
    parameters: ParameterInfo[];
    returnType?: string;
    isAsync: boolean;
}
export interface DecoratorInfo {
    name: string;
    arguments: unknown[];
}
export interface ParameterInfo {
    name: string;
    type?: string;
    decorators: string[];
}
export interface RPCCallInfo {
    functionName: string;
    controllerName: string;
    methodName: string;
    filePath: string;
    line: number;
    column: number;
}
export interface AnalysisResult {
    controllers: ControllerInfo[];
    rpcCalls: RPCCallInfo[];
    serverSideFunctions: string[];
    imports: Map<string, string[]>;
    exports: string[];
}
export declare class ASTAnalyzer {
    private program;
    private typeChecker;
    /**
     * プログラムを初期化
     */
    initialize(configPath: string): void;
    /**
     * 単一ファイルを解析
     */
    analyzeFile(filePath: string): AnalysisResult;
    /**
     * ソースファイルを解析
     */
    analyzeSourceFile(sourceFile: ts.SourceFile): AnalysisResult;
    /**
     * ソースコード文字列を直接解析
     */
    analyzeSource(source: string, fileName?: string): AnalysisResult;
    /**
     * ノードを訪問
     */
    private visitNode;
    /**
     * Import文を解析
     */
    private analyzeImport;
    /**
     * Export文を解析
     */
    private analyzeExport;
    /**
     * クラスを解析 (Controller検出)
     */
    private analyzeClass;
    /**
     * メソッドを解析
     */
    private analyzeMethod;
    /**
     * 関数を解析 (ServerSide検出)
     */
    private analyzeFunction;
    /**
     * 関数呼び出しを解析 (RPC検出)
     */
    private analyzeCallExpression;
    /**
     * ノードからデコレータを取得
     */
    private getDecorators;
}
/**
 * ファイルがコントローラーかどうかを判定
 */
export declare function isControllerFile(filePath: string): boolean;
/**
 * デコレータ名からHTTPメソッドを取得
 */
export declare function httpMethodFromDecorator(decoratorName: string): string | null;
/**
 * コントローラー名からRPCプレフィックスを生成
 */
export declare function controllerToRPCPrefix(controllerName: string): string;
export declare const analyzer: ASTAnalyzer;
//# sourceMappingURL=analyzer.d.ts.map