/**
 * orz.ts Compiler - AST Analyzer
 *
 * TypeScript AST解析
 * - コントローラー検出
 * - サーバーサイド関数検出
 * - RPC呼び出し検出
 */
import * as ts from 'typescript';
// ========================================
// AST Analyzer
// ========================================
export class ASTAnalyzer {
    program = null;
    typeChecker = null;
    /**
     * プログラムを初期化
     */
    initialize(configPath) {
        const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
        if (configFile.error) {
            throw new Error(`Failed to read tsconfig.json: ${configFile.error.messageText}`);
        }
        const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, configPath.replace(/[/\\][^/\\]+$/, ''));
        this.program = ts.createProgram({
            rootNames: parsedConfig.fileNames,
            options: parsedConfig.options,
        });
        this.typeChecker = this.program.getTypeChecker();
    }
    /**
     * 単一ファイルを解析
     */
    analyzeFile(filePath) {
        const sourceFile = this.program?.getSourceFile(filePath);
        if (!sourceFile) {
            throw new Error(`File not found: ${filePath}`);
        }
        return this.analyzeSourceFile(sourceFile);
    }
    /**
     * ソースファイルを解析
     */
    analyzeSourceFile(sourceFile) {
        const result = {
            controllers: [],
            rpcCalls: [],
            serverSideFunctions: [],
            imports: new Map(),
            exports: [],
        };
        // Visit all nodes
        this.visitNode(sourceFile, result, sourceFile);
        return result;
    }
    /**
     * ソースコード文字列を直接解析
     */
    analyzeSource(source, fileName = 'temp.ts') {
        const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        return this.analyzeSourceFile(sourceFile);
    }
    /**
     * ノードを訪問
     */
    visitNode(node, result, sourceFile) {
        // Import declarations
        if (ts.isImportDeclaration(node)) {
            this.analyzeImport(node, result);
        }
        // Export declarations
        if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
            this.analyzeExport(node, result);
        }
        // Class declarations (Controllers)
        if (ts.isClassDeclaration(node)) {
            const controller = this.analyzeClass(node, sourceFile);
            if (controller) {
                result.controllers.push(controller);
            }
        }
        // Function declarations (ServerSide)
        if (ts.isFunctionDeclaration(node)) {
            const serverSide = this.analyzeFunction(node);
            if (serverSide) {
                result.serverSideFunctions.push(serverSide);
            }
        }
        // Call expressions (RPC calls)
        if (ts.isCallExpression(node)) {
            const rpcCall = this.analyzeCallExpression(node, sourceFile);
            if (rpcCall) {
                result.rpcCalls.push(rpcCall);
            }
        }
        // Recurse into children
        ts.forEachChild(node, child => this.visitNode(child, result, sourceFile));
    }
    /**
     * Import文を解析
     */
    analyzeImport(node, result) {
        const moduleSpecifier = node.moduleSpecifier;
        if (!ts.isStringLiteral(moduleSpecifier))
            return;
        const modulePath = moduleSpecifier.text;
        const importedNames = [];
        const importClause = node.importClause;
        if (importClause) {
            // Default import
            if (importClause.name) {
                importedNames.push(importClause.name.text);
            }
            // Named imports
            if (importClause.namedBindings) {
                if (ts.isNamedImports(importClause.namedBindings)) {
                    for (const element of importClause.namedBindings.elements) {
                        importedNames.push(element.name.text);
                    }
                }
                else if (ts.isNamespaceImport(importClause.namedBindings)) {
                    importedNames.push('* as ' + importClause.namedBindings.name.text);
                }
            }
        }
        result.imports.set(modulePath, importedNames);
    }
    /**
     * Export文を解析
     */
    analyzeExport(node, result) {
        if (ts.isExportDeclaration(node)) {
            const exportClause = node.exportClause;
            if (exportClause && ts.isNamedExports(exportClause)) {
                for (const element of exportClause.elements) {
                    result.exports.push(element.name.text);
                }
            }
        }
    }
    /**
     * クラスを解析 (Controller検出)
     */
    analyzeClass(node, sourceFile) {
        const decorators = this.getDecorators(node);
        const controllerDecorator = decorators.find(d => d.name === 'Controller');
        if (!controllerDecorator)
            return null;
        const name = node.name?.text || 'AnonymousController';
        const prefix = controllerDecorator.arguments[0] || '';
        const isServerSide = decorators.some(d => d.name === 'ServerSide');
        const methods = [];
        for (const member of node.members) {
            if (ts.isMethodDeclaration(member)) {
                const methodInfo = this.analyzeMethod(member, sourceFile);
                if (methodInfo) {
                    methods.push(methodInfo);
                }
            }
        }
        return {
            name,
            filePath: sourceFile.fileName,
            prefix,
            methods,
            decorators: decorators.map(d => d.name),
            isServerSide,
        };
    }
    /**
     * メソッドを解析
     */
    analyzeMethod(node, _sourceFile) {
        const decorators = this.getDecorators(node);
        const routeDecorators = ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Route', 'View'];
        const routeDecorator = decorators.find(d => routeDecorators.includes(d.name));
        if (!routeDecorator)
            return null;
        const name = node.name.text;
        let httpMethod = routeDecorator.name.toUpperCase();
        let path = routeDecorator.arguments[0] || '/';
        // Route decorator has method and path
        if (routeDecorator.name === 'Route') {
            httpMethod = routeDecorator.arguments[0];
            path = routeDecorator.arguments[1] || '/';
        }
        const parameters = node.parameters.map(param => ({
            name: param.name.text,
            type: param.type ? param.type.getText() : undefined,
            decorators: this.getDecorators(param).map(d => d.name),
        }));
        const isAsync = !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
        return {
            name,
            httpMethod,
            path,
            decorators,
            parameters,
            returnType: node.type?.getText(),
            isAsync,
        };
    }
    /**
     * 関数を解析 (ServerSide検出)
     */
    analyzeFunction(node) {
        const decorators = this.getDecorators(node);
        const isServerSide = decorators.some(d => d.name === 'ServerSide');
        if (!isServerSide)
            return null;
        return node.name?.text || 'anonymous';
    }
    /**
     * 関数呼び出しを解析 (RPC検出)
     */
    analyzeCallExpression(node, sourceFile) {
        const expression = node.expression;
        // rpcCall('Controller.method', args) pattern
        if (ts.isIdentifier(expression) && expression.text === 'rpcCall') {
            const firstArg = node.arguments[0];
            if (ts.isStringLiteral(firstArg)) {
                const [controllerName, methodName] = firstArg.text.split('.');
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                return {
                    functionName: firstArg.text,
                    controllerName,
                    methodName,
                    filePath: sourceFile.fileName,
                    line: line + 1,
                    column: character + 1,
                };
            }
        }
        // Controller.method() pattern (proxy call)
        if (ts.isPropertyAccessExpression(expression)) {
            // This would require more context to determine if it's an RPC call
            // For now, we only detect explicit rpcCall() invocations
        }
        return null;
    }
    /**
     * ノードからデコレータを取得
     */
    getDecorators(node) {
        const decorators = [];
        // TypeScript 5.0+ uses modifiers array for decorators
        const modifiers = node.modifiers;
        if (!modifiers)
            return decorators;
        for (const modifier of modifiers) {
            if (!ts.isDecorator(modifier))
                continue;
            const expression = modifier.expression;
            let name;
            let args = [];
            if (ts.isCallExpression(expression)) {
                // @Decorator(args)
                if (ts.isIdentifier(expression.expression)) {
                    name = expression.expression.text;
                }
                else {
                    continue;
                }
                args = expression.arguments.map(arg => {
                    if (ts.isStringLiteral(arg))
                        return arg.text;
                    if (ts.isNumericLiteral(arg))
                        return Number(arg.text);
                    if (arg.kind === ts.SyntaxKind.TrueKeyword)
                        return true;
                    if (arg.kind === ts.SyntaxKind.FalseKeyword)
                        return false;
                    if (ts.isArrayLiteralExpression(arg)) {
                        return arg.elements.map(el => {
                            if (ts.isStringLiteral(el))
                                return el.text;
                            return el.getText();
                        });
                    }
                    return arg.getText();
                });
            }
            else if (ts.isIdentifier(expression)) {
                // @Decorator
                name = expression.text;
            }
            else {
                continue;
            }
            decorators.push({ name, arguments: args });
        }
        return decorators;
    }
}
// ========================================
// Utility Functions
// ========================================
/**
 * ファイルがコントローラーかどうかを判定
 */
export function isControllerFile(filePath) {
    return filePath.includes('/controllers/') ||
        filePath.includes('\\controllers\\') ||
        filePath.endsWith('.controller.ts');
}
/**
 * デコレータ名からHTTPメソッドを取得
 */
export function httpMethodFromDecorator(decoratorName) {
    const map = {
        'Get': 'GET',
        'Post': 'POST',
        'Put': 'PUT',
        'Delete': 'DELETE',
        'Patch': 'PATCH',
        'Head': 'HEAD',
        'Options': 'OPTIONS',
    };
    return map[decoratorName] || null;
}
/**
 * コントローラー名からRPCプレフィックスを生成
 */
export function controllerToRPCPrefix(controllerName) {
    return controllerName.replace(/Controller$/, '');
}
// Export singleton instance
export const analyzer = new ASTAnalyzer();
//# sourceMappingURL=analyzer.js.map