/**
 * orz.ts Vite Plugin
 *
 * Vite統合プラグイン
 */
import type { Plugin as VitePlugin } from 'vite';
export interface OrzVitePluginOptions {
    /** プロジェクトルート */
    root?: string;
    /** 追加のViteプラグイン */
    plugins?: VitePlugin[];
}
/**
 * orz.ts Viteプラグイン
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import orz from 'orz.ts/vite';
 *
 * export default defineConfig({
 *   plugins: [orz()],
 * });
 * ```
 */
export declare function orzVitePlugin(options?: OrzVitePluginOptions): VitePlugin[];
export default orzVitePlugin;
//# sourceMappingURL=vite-plugin.d.ts.map