/**
 * orz.ts Compiler Module
 *
 * コンパイラモジュールのエクスポート
 */
export { ASTAnalyzer, analyzer, isControllerFile, httpMethodFromDecorator, controllerToRPCPrefix, } from './analyzer.js';
export { CodeTransformer, transformer, createOrzTransformer, transformControllerFile, stripServerSideCode, extractServerSideCode, } from './transformer.js';
export { CodeOptimizer, optimizer, analyzeBundle, collectUsedMethods, filterUnusedMethods, } from './optimizer.js';
//# sourceMappingURL=index.js.map