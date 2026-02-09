/**
 * orz.ts Built-in Middlewares
 *
 * ビルトインミドルウェア実装
 */
/**
 * ロギングミドルウェア
 */
export class Logging {
    startTime = 0;
    options;
    constructor(options = {}) {
        this.options = {
            level: 'info',
            timestamp: true,
            logArgs: false,
            logResult: false,
            ...options,
        };
    }
    before(ctx) {
        this.startTime = performance.now();
        const message = this.options.timestamp
            ? `[${new Date().toISOString()}] Starting request`
            : 'Starting request';
        this.log(message, this.options.logArgs ? ctx.request : undefined);
    }
    after(ctx, result) {
        const duration = (performance.now() - this.startTime).toFixed(2);
        const message = this.options.timestamp
            ? `[${new Date().toISOString()}] Completed in ${duration}ms`
            : `Completed in ${duration}ms`;
        this.log(message, this.options.logResult ? result : undefined);
    }
    onError(ctx, error) {
        const duration = (performance.now() - this.startTime).toFixed(2);
        const message = this.options.timestamp
            ? `[${new Date().toISOString()}] Failed after ${duration}ms: ${error.message}`
            : `Failed after ${duration}ms: ${error.message}`;
        this.error(message, error);
    }
    log(message, data) {
        if (this.options.logger) {
            this.options.logger(message, data);
        }
        else {
            console.log(message, data !== undefined ? data : '');
        }
    }
    error(message, error) {
        console.error(message, error);
    }
}
/**
 * バリデーションミドルウェアを作成
 */
export function createValidateMiddleware(options) {
    const { schema, message = 'Validation failed', argIndex = 0 } = options;
    return async (ctx) => {
        const args = ctx.request.args;
        const value = args[argIndex];
        // Zod-like schema
        if (typeof schema.parse === 'function') {
            try {
                const validated = schema.parse(value);
                args[argIndex] = validated;
            }
            catch (error) {
                const err = new Error(message);
                err.name = 'ValidationError';
                err.details = error;
                throw err;
            }
            return;
        }
        // Yup-like schema
        if (typeof schema.validate === 'function') {
            try {
                const validated = await schema.validate(value);
                args[argIndex] = validated;
            }
            catch (error) {
                const err = new Error(message);
                err.name = 'ValidationError';
                err.details = error;
                throw err;
            }
            return;
        }
        // Function validator
        if (typeof schema === 'function') {
            const result = await schema(value);
            if (result !== true) {
                const err = new Error(typeof result === 'string' ? result : message);
                err.name = 'ValidationError';
                throw err;
            }
        }
    };
}
const cacheStore = new Map();
/**
 * キャッシュミドルウェア
 */
export class Cache {
    options;
    constructor(options) {
        this.options = options;
    }
    async before(ctx) {
        const key = this.getKey(ctx);
        const cached = cacheStore.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            // Store cached result in context to return later
            ctx.__cachedResult = cached.value;
        }
    }
    after(ctx, result) {
        // Return cached result if exists
        const cachedResult = ctx.__cachedResult;
        if (cachedResult !== undefined) {
            return cachedResult;
        }
        // Store new result in cache
        const key = this.getKey(ctx);
        cacheStore.set(key, {
            value: result,
            expiresAt: Date.now() + this.options.ttl * 1000,
        });
        return result;
    }
    getKey(ctx) {
        if (this.options.keyGenerator) {
            return this.options.keyGenerator(ctx);
        }
        return JSON.stringify(ctx.request.args);
    }
}
/**
 * キャッシュをクリア
 */
export function clearCache(pattern) {
    if (!pattern) {
        cacheStore.clear();
        return;
    }
    for (const key of cacheStore.keys()) {
        if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
            cacheStore.delete(key);
        }
    }
}
const rateLimitStore = new Map();
/**
 * レート制限ミドルウェア
 */
export class RateLimit {
    options;
    constructor(options) {
        this.options = {
            message: 'Too many requests, please try again later.',
            ...options,
        };
    }
    before(ctx) {
        const key = this.getKey(ctx);
        const now = Date.now();
        let entry = rateLimitStore.get(key);
        // Reset if window expired
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + this.options.windowMs };
            rateLimitStore.set(key, entry);
        }
        entry.count++;
        if (entry.count > this.options.count) {
            const error = new Error(this.options.message);
            error.name = 'RateLimitError';
            error.retryAfter =
                Math.ceil((entry.resetAt - now) / 1000);
            throw error;
        }
    }
    getKey(ctx) {
        if (this.options.keyGenerator) {
            return this.options.keyGenerator(ctx);
        }
        return ctx.user?.id ?? ctx.sessionId ?? 'anonymous';
    }
}
/**
 * トランザクションミドルウェア
 */
export class Transaction {
    options;
    transaction = null;
    constructor(options) {
        this.options = options;
    }
    async before(ctx) {
        this.transaction = await this.options.begin();
        ctx.transaction = this.transaction;
    }
    async after() {
        if (this.transaction) {
            await this.options.commit(this.transaction);
        }
    }
    async onError() {
        if (this.transaction) {
            await this.options.rollback(this.transaction);
        }
    }
}
/**
 * 認証ミドルウェアを作成
 */
export function createAuthMiddleware(options = {}) {
    const { roles = [], check, unauthenticatedMessage = 'Authentication required', forbiddenMessage = 'Access denied', } = options;
    return async (ctx) => {
        // Custom check
        if (check) {
            const passed = await check(ctx);
            if (!passed) {
                const error = new Error(forbiddenMessage);
                error.name = 'ForbiddenError';
                throw error;
            }
            return;
        }
        // Check if authenticated
        if (!ctx.user) {
            const error = new Error(unauthenticatedMessage);
            error.name = 'UnauthorizedError';
            throw error;
        }
        // Check roles
        if (roles.length > 0) {
            const userRoles = ctx.user.roles || [];
            const hasRole = roles.some(role => userRoles.includes(role));
            if (!hasRole) {
                const error = new Error(forbiddenMessage);
                error.name = 'ForbiddenError';
                throw error;
            }
        }
    };
}
//# sourceMappingURL=builtin.js.map