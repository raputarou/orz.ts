/**
 * orz.ts Plugin System
 * 
 * プラグインシステム実装
 */

import type { OrzConfig } from '../config/types.js';

// ========================================
// Types
// ========================================

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

// ========================================
// Plugin Manager
// ========================================

export class PluginManager {
    private plugins: Map<string, Plugin> = new Map();
    private context: PluginContext;

    constructor(config: OrzConfig, root: string, isDev: boolean = false) {
        this.context = {
            config,
            root,
            isDev,
            invokePlugin: this.invokePlugin.bind(this),
        };
    }

    /**
     * プラグインを登録
     */
    register(plugin: Plugin): void {
        if (this.plugins.has(plugin.name)) {
            console.warn(`[orz] Plugin '${plugin.name}' is already registered. Overwriting.`);
        }

        // Check dependencies
        if (plugin.dependencies) {
            for (const dep of plugin.dependencies) {
                if (!this.plugins.has(dep)) {
                    throw new Error(
                        `Plugin '${plugin.name}' depends on '${dep}', which is not registered.`
                    );
                }
            }
        }

        this.plugins.set(plugin.name, plugin);
    }

    /**
     * プラグインを取得
     */
    get(name: string): Plugin | undefined {
        return this.plugins.get(name);
    }

    /**
     * 全プラグインを取得（優先度順）
     */
    getAll(): Plugin[] {
        const plugins = Array.from(this.plugins.values());
        return plugins.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    }

    /**
     * プラグインのメソッドを呼び出す
     */
    async invokePlugin(name: string, method: string, ...args: unknown[]): Promise<unknown> {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin '${name}' not found.`);
        }

        const fn = (plugin as unknown as Record<string, unknown>)[method];
        if (typeof fn !== 'function') {
            throw new Error(`Plugin '${name}' does not have method '${method}'.`);
        }

        return fn.call(plugin, ...args);
    }

    /**
     * 全プラグインで特定のフックを実行
     */
    async runHook<K extends keyof PluginHooks>(
        hook: K,
        ...args: Parameters<NonNullable<PluginHooks[K]>>
    ): Promise<void> {
        for (const plugin of this.getAll()) {
            const fn = plugin[hook] as ((...a: unknown[]) => unknown) | undefined;
            if (typeof fn === 'function') {
                await fn.call(plugin, ...args);
            }
        }
    }

    /**
     * 設定を変更するフックを実行（設定を順次変更）
     */
    async runConfigHook(config: OrzConfig): Promise<OrzConfig> {
        let result = config;

        for (const plugin of this.getAll()) {
            if (plugin.configResolved) {
                result = await plugin.configResolved(result);
            }
        }

        return result;
    }

    /**
     * 変換フックを実行
     */
    async runTransformHook(code: string, id: string): Promise<TransformResult> {
        let result: TransformResult = { code };

        for (const plugin of this.getAll()) {
            if (plugin.transform) {
                const transformed = await plugin.transform(result.code, id);
                result = transformed;
            }
        }

        return result;
    }

    /**
     * 初期化
     */
    async init(): Promise<void> {
        await this.runHook('init', this.context);
    }

    /**
     * クリーンアップ
     */
    async destroy(): Promise<void> {
        await this.runHook('destroy');
        this.plugins.clear();
    }
}

// ========================================
// Plugin Definition Helper
// ========================================

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
export function definePlugin(plugin: Plugin): Plugin {
    return plugin;
}

// ========================================
// Built-in Plugins
// ========================================

/**
 * ロギングプラグイン
 */
export const loggingPlugin: Plugin = definePlugin({
    name: '@orz/logging',
    priority: 0,

    init(ctx) {
        console.log(`[orz] Logging plugin initialized (dev: ${ctx.isDev})`);
    },

    buildStart(ctx) {
        console.log(`[orz] Build started at ${ctx.root}`);
    },

    buildEnd(ctx, output) {
        console.log(`[orz] Build completed. ${output.files.length} files written to ${output.outDir}`);
        const totalSize = output.files.reduce((sum, f) => sum + f.size, 0);
        console.log(`[orz] Total size: ${(totalSize / 1024).toFixed(2)} KB`);
    },
});

/**
 * 環境変数プラグイン
 */
export const envPlugin: Plugin = definePlugin({
    name: '@orz/env',
    priority: 10,

    transform(code, id) {
        if (!id.endsWith('.ts') && !id.endsWith('.js')) {
            return { code };
        }

        // Replace import.meta.env.* with actual values
        const transformed = code.replace(
            /import\.meta\.env\.(\w+)/g,
            (match, key) => {
                const value = process.env[key];
                if (value !== undefined) {
                    return JSON.stringify(value);
                }
                return match;
            }
        );

        return { code: transformed };
    },
});
