/**
 * orz.ts Compiler - Optimizer
 *
 * コード最適化
 * - Tree Shaking準備
 * - Dead Code Elimination
 * - Bundle最適化
 */
import type { ControllerInfo, MethodInfo } from './analyzer.js';
export interface OptimizeOptions {
    /** Tree Shaking有効化 */
    treeShake?: boolean;
    /** Dead Code Elimination */
    deadCodeElimination?: boolean;
    /** ミニファイ */
    minify?: boolean;
    /** インライン化閾値（バイト） */
    inlineThreshold?: number;
    /** 定数畳み込み */
    constantFolding?: boolean;
}
export interface OptimizeResult {
    code: string;
    map?: string | null;
    removedExports: string[];
    inlinedFunctions: string[];
    bundleInfo: BundleInfo;
}
export interface BundleInfo {
    /** 元のサイズ */
    originalSize: number;
    /** 最適化後のサイズ */
    optimizedSize: number;
    /** 削減率 */
    reduction: number;
    /** 使用されたコントローラー */
    usedControllers: string[];
    /** 使用されたメソッド */
    usedMethods: string[];
}
export declare class CodeOptimizer {
    private options;
    constructor(options?: OptimizeOptions);
    /**
     * コードを最適化
     */
    optimize(source: string, usedControllers?: ControllerInfo[], _fileName?: string): OptimizeResult;
    /**
     * 定数畳み込み
     */
    private foldConstants;
    /**
     * Dead Code Elimination
     */
    private eliminateDeadCode;
    /**
     * 未使用メソッドを削除（Tree Shaking）
     */
    private shakeUnusedMethods;
    /**
     * 小さな関数をインライン化
     */
    private inlineSmallFunctions;
    /**
     * コードをミニファイ
     */
    private minifyCode;
}
export interface BundleAnalysis {
    totalSize: number;
    modules: ModuleInfo[];
    duplicates: DuplicateInfo[];
    unusedExports: string[];
}
export interface ModuleInfo {
    name: string;
    size: number;
    percentage: number;
    imports: string[];
    exports: string[];
}
export interface DuplicateInfo {
    name: string;
    locations: string[];
    wastedBytes: number;
}
/**
 * バンドルを分析
 */
export declare function analyzeBundle(files: Map<string, string>): BundleAnalysis;
/**
 * 使用されているメソッドを収集
 */
export declare function collectUsedMethods(controllers: ControllerInfo[], rpcCalls: Array<{
    controllerName: string;
    methodName: string;
}>): Map<string, Set<string>>;
/**
 * 使用されていないコントローラーメソッドをフィルタ
 */
export declare function filterUnusedMethods(controller: ControllerInfo, usedMethods: Set<string>): MethodInfo[];
export declare const optimizer: CodeOptimizer;
//# sourceMappingURL=optimizer.d.ts.map