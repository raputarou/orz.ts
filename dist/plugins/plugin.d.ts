/**
 * orz.ts Plugin System
 *
 * プラグインシステム実装
 */
import type { OrzConfig } from '../config/types.js';
export interface PluginContext {
    /** 設定 */
    config: OrzConfig;
    /** プロジェクトルート */
    root: string;
    /** 開発モードかどうか */
    isDev: boolean;
    /** 他のプラグインを呼び出す */
    invokePlugin: (name: string, method: string, ...args: unknown[]) => Promise<unknown>;
}
export interface PluginHooks {
    /** プラグイン初期化 */
    init?: (ctx: PluginContext) => void | Promise<void>;
    /** 設定変更 */
    configResolved?: (config: OrzConfig) => OrzConfig | Promise<OrzConfig>;
    /** ビルド開始 */
    buildStart?: (ctx: PluginContext) => void | Promise<void>;
    /** ビルド完了 */
    buildEnd?: (ctx: PluginContext, output: BuildOutput) => void | Promise<void>;
    /** サーバー起動 */
    serverStart?: (ctx: PluginContext, server: DevServer) => void | Promise<void>;
    /** ファイル変換 */
    transform?: (code: string, id: string) => TransformResult | Promise<TransformResult>;
    /** カスタムルート解決 */
    resolveRoute?: (path: string) => ResolvedRoute | null | Promise<ResolvedRoute | null>;
    /** ミドルウェア登録 */
    registerMiddleware?: (ctx: PluginContext) => MiddlewareDefinition[];
    /** クリーンアップ */
    destroy?: () => void | Promise<void>;
}
export interface Plugin extends PluginHooks {
    /** プラグイン名 */
    name: string;
    /** プラグインバージョン */
    version?: string;
    /** 優先度（小さいほど先に実行） */
    priority?: number;
    /** 依存プラグイン */
    dependencies?: string[];
}
export interface BuildOutput {
    /** 出力ディレクトリ */
    outDir: string;
    /** 出力ファイル */
    files: OutputFile[];
}
export interface OutputFile {
    path: string;
    size: number;
    type: 'js' | 'css' | 'html' | 'asset';
}
export interface DevServer {
    port: number;
    restart: () => Promise<void>;
    close: () => Promise<void>;
}
export interface TransformResult {
    code: string;
    map?: string | null;
}
export interface ResolvedRoute {
    handler: string;
    params?: Record<string, string>;
}
export interface MiddlewareDefinition {
    name: string;
    handler: unknown;
    priority?: number;
}
export declare class PluginManager {
    private plugins;
    private context;
    constructor(config: OrzConfig, root: string, isDev?: boolean);
    /**
     * プラグインを登録
     */
    register(plugin: Plugin): void;
    /**
     * プラグインを取得
     */
    get(name: string): Plugin | undefined;
    /**
     * 全プラグインを取得（優先度順）
     */
    getAll(): Plugin[];
    /**
     * プラグインのメソッドを呼び出す
     */
    invokePlugin(name: string, method: string, ...args: unknown[]): Promise<unknown>;
    /**
     * 全プラグインで特定のフックを実行
     */
    runHook<K extends keyof PluginHooks>(hook: K, ...args: Parameters<NonNullable<PluginHooks[K]>>): Promise<void>;
    /**
     * 設定を変更するフックを実行（設定を順次変更）
     */
    runConfigHook(config: OrzConfig): Promise<OrzConfig>;
    /**
     * 変換フックを実行
     */
    runTransformHook(code: string, id: string): Promise<TransformResult>;
    /**
     * 初期化
     */
    init(): Promise<void>;
    /**
     * クリーンアップ
     */
    destroy(): Promise<void>;
}
/**
 * プラグイン定義ヘルパー
 *
 * @example
 * ```ts
 * export default definePlugin({
 *   name: 'my-plugin',
 *   init(ctx) {
 *     console.log('Plugin initialized');
 *   },
 *   transform(code, id) {
 *     if (id.endsWith('.special')) {
 *       return { code: transformSpecial(code) };
 *     }
 *     return { code };
 *   }
 * });
 * ```
 */
export declare function definePlugin(plugin: Plugin): Plugin;
/**
 * ロギングプラグイン
 */
export declare const loggingPlugin: Plugin;
/**
 * 環境変数プラグイン
 */
export declare const envPlugin: Plugin;
//# sourceMappingURL=plugin.d.ts.map