/**
 * orz.ts Compiler - Optimizer
 *
 * コード最適化
 * - Tree Shaking準備
 * - Dead Code Elimination
 * - Bundle最適化
 */
// ========================================
// Optimizer
// ========================================
export class CodeOptimizer {
    options;
    constructor(options = {}) {
        this.options = {
            treeShake: true,
            deadCodeElimination: true,
            minify: false,
            inlineThreshold: 100,
            constantFolding: true,
            ...options,
        };
    }
    /**
     * コードを最適化
     */
    optimize(source, usedControllers = [], _fileName = 'module.ts') {
        const originalSize = source.length;
        let optimized = source;
        const removedExports = [];
        const inlinedFunctions = [];
        // 1. 定数畳み込み
        if (this.options.constantFolding) {
            optimized = this.foldConstants(optimized);
        }
        // 2. Dead Code Elimination
        if (this.options.deadCodeElimination) {
            const dceResult = this.eliminateDeadCode(optimized);
            optimized = dceResult.code;
            removedExports.push(...dceResult.removed);
        }
        // 3. 未使用メソッド削除
        if (this.options.treeShake && usedControllers.length > 0) {
            optimized = this.shakeUnusedMethods(optimized, usedControllers);
        }
        // 4. 小さな関数のインライン化
        if (this.options.inlineThreshold && this.options.inlineThreshold > 0) {
            const inlineResult = this.inlineSmallFunctions(optimized);
            optimized = inlineResult.code;
            inlinedFunctions.push(...inlineResult.inlined);
        }
        // 5. ミニファイ（空白・コメント削除）
        if (this.options.minify) {
            optimized = this.minifyCode(optimized);
        }
        const optimizedSize = optimized.length;
        const reduction = originalSize > 0
            ? ((originalSize - optimizedSize) / originalSize) * 100
            : 0;
        return {
            code: optimized,
            map: null,
            removedExports,
            inlinedFunctions,
            bundleInfo: {
                originalSize,
                optimizedSize,
                reduction,
                usedControllers: usedControllers.map(c => c.name),
                usedMethods: usedControllers.flatMap(c => c.methods.map(m => `${c.name}.${m.name}`)),
            },
        };
    }
    /**
     * 定数畳み込み
     */
    foldConstants(code) {
        // 基本的な定数式を評価
        // 例: 1 + 2 → 3, "hello" + "world" → "helloworld"
        // 数値演算
        let result = code.replace(/(\d+)\s*\+\s*(\d+)/g, (_, a, b) => String(Number(a) + Number(b)));
        result = result.replace(/(\d+)\s*\*\s*(\d+)/g, (_, a, b) => String(Number(a) * Number(b)));
        // 文字列結合（シンプルなケースのみ）
        result = result.replace(/'([^']+)'\s*\+\s*'([^']+)'/g, (_, a, b) => `'${a}${b}'`);
        result = result.replace(/"([^"]+)"\s*\+\s*"([^"]+)"/g, (_, a, b) => `"${a}${b}"`);
        return result;
    }
    /**
     * Dead Code Elimination
     */
    eliminateDeadCode(code) {
        const removed = [];
        let result = code;
        // if (false) { ... } ブロックを削除
        result = result.replace(/if\s*\(\s*false\s*\)\s*\{[^}]*\}/g, '');
        // 常に真の条件を簡略化
        result = result.replace(/if\s*\(\s*true\s*\)\s*\{([^}]*)\}/g, '$1');
        // process.env.NODE_ENV === 'development' の評価
        if (process.env.NODE_ENV === 'production') {
            // 開発専用コードを削除
            result = result.replace(/if\s*\(\s*process\.env\.NODE_ENV\s*===?\s*['"]development['"]\s*\)\s*\{[^}]*\}/g, (match) => {
                removed.push('development-only block');
                return '';
            });
        }
        // クリーンアップ
        result = result.replace(/\n{3,}/g, '\n\n');
        return { code: result, removed };
    }
    /**
     * 未使用メソッドを削除（Tree Shaking）
     */
    shakeUnusedMethods(code, usedControllers) {
        // 使用されているメソッド名を収集
        const usedMethods = new Set();
        for (const controller of usedControllers) {
            for (const method of controller.methods) {
                usedMethods.add(`${controller.name}.${method.name}`);
            }
        }
        // TODO: 完全なTree Shakingの実装
        // 現在は単純な実装として、メソッドマーカーを追加
        return code;
    }
    /**
     * 小さな関数をインライン化
     */
    inlineSmallFunctions(code) {
        const inlined = [];
        const threshold = this.options.inlineThreshold || 100;
        // パターン: const fn = () => expr;
        // 短い関数を検出してインライン候補としてマーク
        // 現在は単純な実装として、何もしない
        // 完全な実装にはAST解析が必要
        return { code, inlined };
    }
    /**
     * コードをミニファイ
     */
    minifyCode(code) {
        let result = code;
        // コメント削除
        result = result.replace(/\/\/[^\n]*/g, '');
        result = result.replace(/\/\*[\s\S]*?\*\//g, '');
        // 余分な空白を削除
        result = result.replace(/\s+/g, ' ');
        // 演算子周りの空白を削除
        result = result.replace(/\s*([{}()[\];,:])\s*/g, '$1');
        result = result.replace(/\s*([=+\-*/<>!&|])\s*/g, '$1');
        // 改行を削除（セミコロンの後は保持）
        result = result.replace(/;\s*/g, ';');
        return result.trim();
    }
}
/**
 * バンドルを分析
 */
export function analyzeBundle(files) {
    const modules = [];
    let totalSize = 0;
    for (const [name, content] of files) {
        const size = content.length;
        totalSize += size;
        // インポートを抽出
        const imports = [];
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        // エクスポートを抽出
        const exports = [];
        const exportRegex = /export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
        while ((match = exportRegex.exec(content)) !== null) {
            exports.push(match[1]);
        }
        modules.push({
            name,
            size,
            percentage: 0, // 後で計算
            imports,
            exports,
        });
    }
    // パーセンテージを計算
    for (const module of modules) {
        module.percentage = totalSize > 0 ? (module.size / totalSize) * 100 : 0;
    }
    // 重複を検出
    const duplicates = detectDuplicates(modules);
    // 未使用エクスポートを検出
    const unusedExports = detectUnusedExports(modules);
    return {
        totalSize,
        modules: modules.sort((a, b) => b.size - a.size),
        duplicates,
        unusedExports,
    };
}
/**
 * 重複コードを検出
 */
function detectDuplicates(modules) {
    // 同じ名前のエクスポートを持つモジュールを検出
    const exportMap = new Map();
    for (const module of modules) {
        for (const exp of module.exports) {
            const locations = exportMap.get(exp) || [];
            locations.push(module.name);
            exportMap.set(exp, locations);
        }
    }
    const duplicates = [];
    for (const [name, locations] of exportMap) {
        if (locations.length > 1) {
            duplicates.push({
                name,
                locations,
                wastedBytes: 0, // 実際のサイズ計算は省略
            });
        }
    }
    return duplicates;
}
/**
 * 未使用エクスポートを検出
 */
function detectUnusedExports(modules) {
    const allImports = new Set();
    const allExports = new Set();
    for (const module of modules) {
        for (const imp of module.imports) {
            allImports.add(imp);
        }
        for (const exp of module.exports) {
            allExports.add(`${module.name}:${exp}`);
        }
    }
    // インポートされていないエクスポートを検出
    const unused = [];
    for (const exp of allExports) {
        const [, name] = exp.split(':');
        // 簡易チェック - 完全な実装には依存関係グラフが必要
        if (!allImports.has(name)) {
            unused.push(exp);
        }
    }
    return unused;
}
// ========================================
// Utility Functions
// ========================================
/**
 * 使用されているメソッドを収集
 */
export function collectUsedMethods(controllers, rpcCalls) {
    const usedMethods = new Map();
    for (const call of rpcCalls) {
        const methods = usedMethods.get(call.controllerName) || new Set();
        methods.add(call.methodName);
        usedMethods.set(call.controllerName, methods);
    }
    return usedMethods;
}
/**
 * 使用されていないコントローラーメソッドをフィルタ
 */
export function filterUnusedMethods(controller, usedMethods) {
    return controller.methods.filter(m => usedMethods.has(m.name));
}
// Export singleton
export const optimizer = new CodeOptimizer();
//# sourceMappingURL=optimizer.js.map