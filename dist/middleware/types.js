/**
 * orz.ts Middleware Types
 *
 * ミドルウェアシステムの型定義
 */
/**
 * ミドルウェアチェーンを作成
 */
export function createMiddlewareChain() {
    const middlewares = [];
    return {
        use(middleware) {
            middlewares.push(middleware);
            return this;
        },
        async execute(ctx, handler) {
            const instances = [];
            // Instantiate and run before hooks
            for (const mw of middlewares) {
                const instance = instantiateMiddleware(mw);
                instances.push(instance);
                if (instance.before) {
                    await instance.before(ctx);
                }
            }
            let result;
            let error = null;
            try {
                result = await handler();
            }
            catch (e) {
                error = e instanceof Error ? e : new Error(String(e));
                // Run error hooks in reverse order
                for (let i = instances.length - 1; i >= 0; i--) {
                    const instance = instances[i];
                    if (instance.onError) {
                        await instance.onError(ctx, error);
                    }
                }
                throw error;
            }
            // Run after hooks in reverse order
            for (let i = instances.length - 1; i >= 0; i--) {
                const instance = instances[i];
                if (instance.after) {
                    const transformed = await instance.after(ctx, result);
                    if (transformed !== undefined) {
                        result = transformed;
                    }
                }
            }
            return result;
        },
    };
}
/**
 * ミドルウェアをインスタンス化
 */
function instantiateMiddleware(middleware) {
    // Function type
    if (typeof middleware === 'function' && !middleware.prototype?.before) {
        return {
            before: middleware,
        };
    }
    // Class type
    if (typeof middleware === 'function') {
        return new middleware();
    }
    // Object type
    return middleware;
}
//# sourceMappingURL=types.js.map