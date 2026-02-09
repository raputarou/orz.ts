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
export declare const METADATA_KEYS: {
    readonly CONTROLLER: "orz:controller";
    readonly ROUTES: "orz:routes";
    readonly VIEW: "orz:view";
    readonly AUTH: "orz:auth";
    readonly VALIDATE: "orz:validate";
    readonly SERVER_SIDE: "orz:server_side";
    readonly MIDDLEWARE: "orz:middleware";
    readonly DEPLOY: "orz:deploy";
    readonly CACHE: "orz:cache";
    readonly RATE_LIMIT: "orz:rate_limit";
    readonly TRANSACTION: "orz:transaction";
};
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
    ttl: number;
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
declare class ControllerRegistry {
    private controllers;
    register(name: string, target: Function): void;
    addRoute(controllerName: string, route: RouteMetadata): void;
    getController(name: string): {
        target: Function;
        routes: RouteMetadata[];
    } | undefined;
    getAllControllers(): [string, {
        target: Function;
        routes: RouteMetadata[];
    }][];
    getRouteMap(): Map<string, {
        controller: string;
        method: string;
        handler: string;
    }>;
}
export declare const controllerRegistry: ControllerRegistry;
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
export declare function Controller(target: Function): void;
export declare function Controller(prefix?: string): ClassDecorator;
/**
 * @ServerSide - サーバー専用関数としてマーク
 * ビルド時にWorkerへ隔離される
 */
export declare function ServerSide(target: Function): void;
/**
 * @Deploy - デプロイ先を指定
 *
 * @param target 'origin' | 'edge' | 'worker'
 */
export declare function Deploy(target: DeployMetadata['target']): ClassDecorator;
/**
 * @Route - 汎用ルート定義
 *
 * @example
 * ```ts
 * @Route('GET', '/api/users/:id')
 * async getUser(id: string) { ... }
 * ```
 */
export declare function Route(method: HttpMethod, path: string): MethodDecorator;
export declare function Route(pathWithMethod: string): MethodDecorator;
/** @Get - GETリクエスト用ルート */
export declare const Get: (path: string) => MethodDecorator;
/** @Post - POSTリクエスト用ルート */
export declare const Post: (path: string) => MethodDecorator;
/** @Put - PUTリクエスト用ルート */
export declare const Put: (path: string) => MethodDecorator;
/** @Delete - DELETEリクエスト用ルート */
export declare const Delete: (path: string) => MethodDecorator;
/** @Patch - PATCHリクエスト用ルート */
export declare const Patch: (path: string) => MethodDecorator;
/**
 * @View - HTMLレスポンスを返すルート
 *
 * @param path ルートパス
 */
export declare function View(path: string): MethodDecorator;
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
export declare function Auth(...roles: string[]): MethodDecorator;
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
export declare function Validate(schema: unknown): MethodDecorator;
/**
 * @Use - ミドルウェア適用デコレータ
 *
 * @param middleware 適用するミドルウェア
 */
export declare function Use(...middleware: Function[]): MethodDecorator;
/**
 * @Cache - レスポンスキャッシュデコレータ
 *
 * @param ttl キャッシュ有効期間（秒）
 * @param key オプションのキャッシュキー
 */
export declare function Cache(ttl: number, key?: string): MethodDecorator;
/**
 * @RateLimit - レート制限デコレータ
 *
 * @param count 許可するリクエスト数
 * @param windowMs 時間ウィンドウ（ミリ秒）
 */
export declare function RateLimit(count: number, windowMs: number): MethodDecorator;
/**
 * @Transaction - DBトランザクションデコレータ
 */
export declare function Transaction(): MethodDecorator;
/**
 * コントローラーからメタデータを取得
 */
export declare function getControllerMetadata(target: Function): {
    controller: any;
    routes: RouteMetadata[];
    serverSide: any;
    deploy: DeployMetadata | undefined;
};
/**
 * メソッドからメタデータを取得
 */
export declare function getMethodMetadata(target: Object, propertyKey: string | symbol): {
    auth: AuthMetadata | undefined;
    validate: ValidateMetadata | undefined;
    middleware: MiddlewareMetadata | undefined;
    cache: CacheMetadata | undefined;
    rateLimit: RateLimitMetadata | undefined;
    transaction: boolean | undefined;
    view: {
        path: string;
    } | undefined;
};
export {};
//# sourceMappingURL=decorators.d.ts.map