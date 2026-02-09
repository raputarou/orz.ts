/**
 * orz.ts Plugin System
 *
 * プラグインシステム実装
 */
// ========================================
// Plugin Manager
// ========================================
export class PluginManager {
    plugins = new Map();
    context;
    constructor(config, root, isDev = false) {
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
    register(plugin) {
        if (this.plugins.has(plugin.name)) {
            console.warn(`[orz] Plugin '${plugin.name}' is already registered. Overwriting.`);
        }
        // Check dependencies
        if (plugin.dependencies) {
            for (const dep of plugin.dependencies) {
                if (!this.plugins.has(dep)) {
                    throw new Error(`Plugin '${plugin.name}' depends on '${dep}', which is not registered.`);
                }
            }
        }
        this.plugins.set(plugin.name, plugin);
    }
    /**
     * プラグインを取得
     */
    get(name) {
        return this.plugins.get(name);
    }
    /**
     * 全プラグインを取得（優先度順）
     */
    getAll() {
        const plugins = Array.from(this.plugins.values());
        return plugins.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    }
    /**
     * プラグインのメソッドを呼び出す
     */
    async invokePlugin(name, method, ...args) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin '${name}' not found.`);
        }
        const fn = plugin[method];
        if (typeof fn !== 'function') {
            throw new Error(`Plugin '${name}' does not have method '${method}'.`);
        }
        return fn.call(plugin, ...args);
    }
    /**
     * 全プラグインで特定のフックを実行
     */
    async runHook(hook, ...args) {
        for (const plugin of this.getAll()) {
            const fn = plugin[hook];
            if (typeof fn === 'function') {
                await fn.call(plugin, ...args);
            }
        }
    }
    /**
     * 設定を変更するフックを実行（設定を順次変更）
     */
    async runConfigHook(config) {
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
    async runTransformHook(code, id) {
        let result = { code };
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
    async init() {
        await this.runHook('init', this.context);
    }
    /**
     * クリーンアップ
     */
    async destroy() {
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
export function definePlugin(plugin) {
    return plugin;
}
// ========================================
// Built-in Plugins
// ========================================
/**
 * ロギングプラグイン
 */
export const loggingPlugin = definePlugin({
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
export const envPlugin = definePlugin({
    name: '@orz/env',
    priority: 10,
    transform(code, id) {
        if (!id.endsWith('.ts') && !id.endsWith('.js')) {
            return { code };
        }
        // Replace import.meta.env.* with actual values
        const transformed = code.replace(/import\.meta\.env\.(\w+)/g, (match, key) => {
            const value = process.env[key];
            if (value !== undefined) {
                return JSON.stringify(value);
            }
            return match;
        });
        return { code: transformed };
    },
});
//# sourceMappingURL=plugin.js.map