/**
 * orz.ts Core Decorators
 *
 * デコレータシステムの実装:
 * - @Controller - クラスをControllerとしてマーク
 * - @Route/@Get/@Post - ルート定義
 * - @View - HTMLレスポンス
 * - @Auth - 認証・認可
 * - @Validate - バリデーション
 * - @ServerSide - サーバー専用マーカー
 * - @Use - ミドルウェア適用
 */
import 'reflect-metadata';
// ========================================
// Metadata Keys
// ========================================
export const METADATA_KEYS = {
    CONTROLLER: 'orz:controller',
    ROUTES: 'orz:routes',
    VIEW: 'orz:view',
    AUTH: 'orz:auth',
    VALIDATE: 'orz:validate',
    SERVER_SIDE: 'orz:server_side',
    MIDDLEWARE: 'orz:middleware',
    DEPLOY: 'orz:deploy',
    CACHE: 'orz:cache',
    RATE_LIMIT: 'orz:rate_limit',
    TRANSACTION: 'orz:transaction',
};
// ========================================
// Controller Registry
// ========================================
class ControllerRegistry {
    controllers = new Map();
    register(name, target) {
        if (!this.controllers.has(name)) {
            this.controllers.set(name, { target, routes: [] });
        }
    }
    addRoute(controllerName, route) {
        const controller = this.controllers.get(controllerName);
        if (controller) {
            controller.routes.push(route);
        }
    }
    getController(name) {
        return this.controllers.get(name);
    }
    getAllControllers() {
        return Array.from(this.controllers.entries());
    }
    getRouteMap() {
        const routeMap = new Map();
        for (const [name, { routes }] of this.controllers) {
            for (const route of routes) {
                const key = `${route.method} ${route.path}`;
                routeMap.set(key, {
                    controller: name,
                    method: route.method,
                    handler: String(route.propertyKey),
                });
            }
        }
        return routeMap;
    }
}
export const controllerRegistry = new ControllerRegistry();
export function Controller(targetOrPrefix) {
    if (typeof targetOrPrefix === 'function') {
        // @Controller (without parentheses)
        const target = targetOrPrefix;
        const name = target.name;
        Reflect.defineMetadata(METADATA_KEYS.CONTROLLER, { prefix: '' }, target);
        controllerRegistry.register(name, target);
    }
    else {
        // @Controller('/prefix')
        return (target) => {
            const prefix = targetOrPrefix || '';
            const name = target.name;
            Reflect.defineMetadata(METADATA_KEYS.CONTROLLER, { prefix }, target);
            controllerRegistry.register(name, target);
        };
    }
}
/**
 * @ServerSide - サーバー専用関数としてマーク
 * ビルド時にWorkerへ隔離される
 */
export function ServerSide(target) {
    Reflect.defineMetadata(METADATA_KEYS.SERVER_SIDE, true, target);
}
/**
 * @Deploy - デプロイ先を指定
 *
 * @param target 'origin' | 'edge' | 'worker'
 */
export function Deploy(target) {
    return (constructor) => {
        Reflect.defineMetadata(METADATA_KEYS.DEPLOY, { target }, constructor);
    };
}
// ========================================
// Method Decorators - Routing
// ========================================
function createRouteDecorator(method) {
    return function (path) {
        return (target, propertyKey, descriptor) => {
            const controllerName = target.constructor.name;
            // Get existing routes or initialize
            const existingRoutes = Reflect.getMetadata(METADATA_KEYS.ROUTES, target.constructor) || [];
            const routeMetadata = {
                method,
                path,
                propertyKey,
            };
            existingRoutes.push(routeMetadata);
            Reflect.defineMetadata(METADATA_KEYS.ROUTES, existingRoutes, target.constructor);
            // Register with controller registry
            controllerRegistry.register(controllerName, target.constructor);
            controllerRegistry.addRoute(controllerName, routeMetadata);
            return descriptor;
        };
    };
}
export function Route(methodOrPath, path) {
    if (path !== undefined) {
        // @Route('GET', '/path')
        return createRouteDecorator(methodOrPath)(path);
    }
    else {
        // @Route('GET /path')
        const [method, ...pathParts] = methodOrPath.split(' ');
        const fullPath = pathParts.join(' ');
        return createRouteDecorator(method.toUpperCase())(fullPath);
    }
}
/** @Get - GETリクエスト用ルート */
export const Get = createRouteDecorator('GET');
/** @Post - POSTリクエスト用ルート */
export const Post = createRouteDecorator('POST');
/** @Put - PUTリクエスト用ルート */
export const Put = createRouteDecorator('PUT');
/** @Delete - DELETEリクエスト用ルート */
export const Delete = createRouteDecorator('DELETE');
/** @Patch - PATCHリクエスト用ルート */
export const Patch = createRouteDecorator('PATCH');
/**
 * @View - HTMLレスポンスを返すルート
 *
 * @param path ルートパス
 */
export function View(path) {
    return (target, propertyKey, descriptor) => {
        Reflect.defineMetadata(METADATA_KEYS.VIEW, { path }, target, propertyKey);
        // Also register as GET route
        return createRouteDecorator('GET')(path)(target, propertyKey, descriptor);
    };
}
// ========================================
// Method Decorators - Security & Validation
// ========================================
/**
 * @Auth - 認証・認可デコレータ
 *
 * @param roles 許可するロール
 *
 * @example
 * ```ts
 * @Auth('admin')
 * @Get('/admin/users')
 * async getAdminUsers() { ... }
 * ```
 */
export function Auth(...roles) {
    return (target, propertyKey, descriptor) => {
        const metadata = { roles };
        Reflect.defineMetadata(METADATA_KEYS.AUTH, metadata, target, propertyKey);
        return descriptor;
    };
}
/**
 * @Validate - バリデーションデコレータ
 *
 * @param schema バリデーションスキーマ (Zod, Yup等)
 *
 * @example
 * ```ts
 * @Validate(UserSchema)
 * @Post('/api/users')
 * async createUser(data: unknown) { ... }
 * ```
 */
export function Validate(schema) {
    return (target, propertyKey, descriptor) => {
        const metadata = { schema };
        Reflect.defineMetadata(METADATA_KEYS.VALIDATE, metadata, target, propertyKey);
        return descriptor;
    };
}
// ========================================
// Method Decorators - Middleware & Performance
// ========================================
/**
 * @Use - ミドルウェア適用デコレータ
 *
 * @param middleware 適用するミドルウェア
 */
export function Use(...middleware) {
    return (target, propertyKey, descriptor) => {
        const existing = Reflect.getMetadata(METADATA_KEYS.MIDDLEWARE, target, propertyKey) || { middleware: [] };
        const existingMiddleware = Array.isArray(existing.middleware)
            ? existing.middleware
            : [existing.middleware];
        const metadata = {
            middleware: [...existingMiddleware, ...middleware]
        };
        Reflect.defineMetadata(METADATA_KEYS.MIDDLEWARE, metadata, target, propertyKey);
        return descriptor;
    };
}
/**
 * @Cache - レスポンスキャッシュデコレータ
 *
 * @param ttl キャッシュ有効期間（秒）
 * @param key オプションのキャッシュキー
 */
export function Cache(ttl, key) {
    return (target, propertyKey, descriptor) => {
        const metadata = { ttl, key };
        Reflect.defineMetadata(METADATA_KEYS.CACHE, metadata, target, propertyKey);
        return descriptor;
    };
}
/**
 * @RateLimit - レート制限デコレータ
 *
 * @param count 許可するリクエスト数
 * @param windowMs 時間ウィンドウ（ミリ秒）
 */
export function RateLimit(count, windowMs) {
    return (target, propertyKey, descriptor) => {
        const metadata = { count, windowMs };
        Reflect.defineMetadata(METADATA_KEYS.RATE_LIMIT, metadata, target, propertyKey);
        return descriptor;
    };
}
/**
 * @Transaction - DBトランザクションデコレータ
 */
export function Transaction() {
    return (target, propertyKey, descriptor) => {
        Reflect.defineMetadata(METADATA_KEYS.TRANSACTION, true, target, propertyKey);
        return descriptor;
    };
}
// ========================================
// Utility Functions
// ========================================
/**
 * コントローラーからメタデータを取得
 */
export function getControllerMetadata(target) {
    return {
        controller: Reflect.getMetadata(METADATA_KEYS.CONTROLLER, target),
        routes: Reflect.getMetadata(METADATA_KEYS.ROUTES, target) || [],
        serverSide: Reflect.getMetadata(METADATA_KEYS.SERVER_SIDE, target),
        deploy: Reflect.getMetadata(METADATA_KEYS.DEPLOY, target),
    };
}
/**
 * メソッドからメタデータを取得
 */
export function getMethodMetadata(target, propertyKey) {
    return {
        auth: Reflect.getMetadata(METADATA_KEYS.AUTH, target, propertyKey),
        validate: Reflect.getMetadata(METADATA_KEYS.VALIDATE, target, propertyKey),
        middleware: Reflect.getMetadata(METADATA_KEYS.MIDDLEWARE, target, propertyKey),
        cache: Reflect.getMetadata(METADATA_KEYS.CACHE, target, propertyKey),
        rateLimit: Reflect.getMetadata(METADATA_KEYS.RATE_LIMIT, target, propertyKey),
        transaction: Reflect.getMetadata(METADATA_KEYS.TRANSACTION, target, propertyKey),
        view: Reflect.getMetadata(METADATA_KEYS.VIEW, target, propertyKey),
    };
}
//# sourceMappingURL=decorators.js.map