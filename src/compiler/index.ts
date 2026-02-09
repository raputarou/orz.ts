/**
 * orz.ts Compiler Module
 * 
 * コンパイラモジュールのエクスポート
 */

export {
    ASTAnalyzer,
    analyzer,
    isControllerFile,
    httpMethodFromDecorator,
    controllerToRPCPrefix,
    type ControllerInfo,
    type MethodInfo,
    type DecoratorInfo,
    type ParameterInfo,
    type RPCCallInfo,
    type AnalysisResult,
} from './analyzer.js';

export {
    CodeTransformer,
    transformer,
    createOrzTransformer,
    transformControllerFile,
    stripServerSideCode,
    extractServerSideCode,
    type TransformOptions,
    type TransformResult,
} from './transformer.js';

export {
    CodeOptimizer,
    optimizer,
    analyzeBundle,
    collectUsedMethods,
    filterUnusedMethods,
    type OptimizeOptions,
    type OptimizeResult,
    type BundleInfo,
    type BundleAnalysis,
    type ModuleInfo,
    type DuplicateInfo,
} from './optimizer.js';
