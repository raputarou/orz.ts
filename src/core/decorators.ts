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
} as const;

// ========================================
// Types
// ========================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface RouteMetadata {
    method: HttpMethod;
    path: string;
    propertyKey: string | symbol;
}

export interface AuthMetadata {
    roles: string[];
}

export interface ValidateMetadata {
    schema: unknown;
}

export interface CacheMetadata {
    ttl: number; // seconds
    key?: string;
}

export interface RateLimitMetadata {
    count: number;
    windowMs: number;
}

export interface MiddlewareMetadata {
    middleware: Function | Function[];
}

export interface DeployMetadata {
    target: 'origin' | 'edge' | 'worker';
}

// ========================================
// Controller Registry
// ========================================

class ControllerRegistry {
    private controllers = new Map<string, { target: Function; routes: RouteMetadata[] }>();

    register(name: string, target: Function): void {
        if (!this.controllers.has(name)) {
            this.controllers.set(name, { target, routes: [] });
        }
    }

    addRoute(controllerName: string, route: RouteMetadata): void {
        const controller = this.controllers.get(controllerName);
        if (controller) {
            controller.routes.push(route);
        }
    }

    getController(name: string) {
        return this.controllers.get(name);
    }

    getAllControllers() {
        return Array.from(this.controllers.entries());
    }

    getRouteMap(): Map<string, { controller: string; method: string; handler: string }> {
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

// ========================================
// Class Decorators
// ========================================

/**
 * @Controller - マークしたクラスをControllerとして登録
 * 
 * @example
 * ```ts
 * @Controller
 * export class UserController {
 *   @Get('/api/users')
 *   async getUsers() { ... }
 * }
 * ```
 */
export function Controller(target: Function): void;
export function Controller(prefix?: string): ClassDecorator;
export function Controller(targetOrPrefix?: Function | string): void | ClassDecorator {
    if (typeof targetOrPrefix === 'function') {
        // @Controller (without parentheses)
        const target = targetOrPrefix;
        const name = target.name;
        Reflect.defineMetadata(METADATA_KEYS.CONTROLLER, { prefix: '' }, target);
        controllerRegistry.register(name, target);
    } else {
        // @Controller('/prefix')
        return (target: Function) => {
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
export function ServerSide(target: Function): void {
    Reflect.defineMetadata(METADATA_KEYS.SERVER_SIDE, true, target);
}

/**
 * @Deploy - デプロイ先を指定
 * 
 * @param target 'origin' | 'edge' | 'worker'
 */
export function Deploy(target: DeployMetadata['target']): ClassDecorator {
    return (constructor: Function) => {
        Reflect.defineMetadata(METADATA_KEYS.DEPLOY, { target } as DeployMetadata, constructor);
    };
}

// ========================================
// Method Decorators - Routing
// ========================================

function createRouteDecorator(method: HttpMethod) {
    return function (path: string): MethodDecorator {
        return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
            const controllerName = target.constructor.name;

            // Get existing routes or initialize
            const existingRoutes: RouteMetadata[] =
                Reflect.getMetadata(METADATA_KEYS.ROUTES, target.constructor) || [];

            const routeMetadata: RouteMetadata = {
                method,
                path,
                propertyKey,
            };

            existingRoutes.push(routeMetadata);
            Reflect.defineMetadata(METADATA_KEYS.ROUTES, existingRoutes, target.constructor);

            // Register with controller registry
            controllerRegistry.register(controllerName, target.constructor as Function);
            controllerRegistry.addRoute(controllerName, routeMetadata);

            return descriptor;
        };
    };
}

/**
 * @Route - 汎用ルート定義
 * 
 * @example
 * ```ts
 * @Route('GET', '/api/users/:id')
 * async getUser(id: string) { ... }
 * ```
 */
export function Route(method: HttpMethod, path: string): MethodDecorator;
export function Route(pathWithMethod: string): MethodDecorator;
export function Route(methodOrPath: HttpMethod | string, path?: string): MethodDecorator {
    if (path !== undefined) {
        // @Route('GET', '/path')
        return createRouteDecorator(methodOrPath as HttpMethod)(path);
    } else {
        // @Route('GET /path')
        const [method, ...pathParts] = methodOrPath.split(' ');
        const fullPath = pathParts.join(' ');
        return createRouteDecorator(method.toUpperCase() as HttpMethod)(fullPath);
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
export function View(path: string): MethodDecorator {
    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
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
export function Auth(...roles: string[]): MethodDecorator {
    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const metadata: AuthMetadata = { roles };
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
export function Validate(schema: unknown): MethodDecorator {
    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const metadata: ValidateMetadata = { schema };
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
export function Use(...middleware: Function[]): MethodDecorator {
    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const existing: MiddlewareMetadata =
            Reflect.getMetadata(METADATA_KEYS.MIDDLEWARE, target, propertyKey) || { middleware: [] };

        const existingMiddleware = Array.isArray(existing.middleware)
            ? existing.middleware
            : [existing.middleware];

        const metadata: MiddlewareMetadata = {
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
export function Cache(ttl: number, key?: string): MethodDecorator {
    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const metadata: CacheMetadata = { ttl, key };
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
export function RateLimit(count: number, windowMs: number): MethodDecorator {
    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const metadata: RateLimitMetadata = { count, windowMs };
        Reflect.defineMetadata(METADATA_KEYS.RATE_LIMIT, metadata, target, propertyKey);
        return descriptor;
    };
}

/**
 * @Transaction - DBトランザクションデコレータ
 */
export function Transaction(): MethodDecorator {
    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
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
export function getControllerMetadata(target: Function) {
    return {
        controller: Reflect.getMetadata(METADATA_KEYS.CONTROLLER, target),
        routes: Reflect.getMetadata(METADATA_KEYS.ROUTES, target) as RouteMetadata[] || [],
        serverSide: Reflect.getMetadata(METADATA_KEYS.SERVER_SIDE, target),
        deploy: Reflect.getMetadata(METADATA_KEYS.DEPLOY, target) as DeployMetadata | undefined,
    };
}

/**
 * メソッドからメタデータを取得
 */
export function getMethodMetadata(target: Object, propertyKey: string | symbol) {
    return {
        auth: Reflect.getMetadata(METADATA_KEYS.AUTH, target, propertyKey) as AuthMetadata | undefined,
        validate: Reflect.getMetadata(METADATA_KEYS.VALIDATE, target, propertyKey) as ValidateMetadata | undefined,
        middleware: Reflect.getMetadata(METADATA_KEYS.MIDDLEWARE, target, propertyKey) as MiddlewareMetadata | undefined,
        cache: Reflect.getMetadata(METADATA_KEYS.CACHE, target, propertyKey) as CacheMetadata | undefined,
        rateLimit: Reflect.getMetadata(METADATA_KEYS.RATE_LIMIT, target, propertyKey) as RateLimitMetadata | undefined,
        transaction: Reflect.getMetadata(METADATA_KEYS.TRANSACTION, target, propertyKey) as boolean | undefined,
        view: Reflect.getMetadata(METADATA_KEYS.VIEW, target, propertyKey) as { path: string } | undefined,
    };
}
