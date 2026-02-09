/**
 * orz.ts Configuration Loader
 *
 * 設定ファイルの読み込みと解析
 */
import type { OrzJsonConfig, OrzConfig } from './types.js';
import { defaultConfig, defaultBuildConfig, defaultServerConfig } from './types.js';
export interface LoadedConfig {
    orzJson: Required<OrzJsonConfig>;
    orzConfig: OrzConfig;
    root: string;
}
/**
 * 設定ファイルを読み込む
 *
 * @param root プロジェクトルートディレクトリ
 * @returns 読み込まれた設定
 */
export declare function loadConfig(root?: string): Promise<LoadedConfig>;
/**
 * orz.json を読み込む
 */
export declare function loadOrzJson(root: string): Required<OrzJsonConfig>;
/**
 * orz.config.ts を読み込む
 */
export declare function loadOrzConfig(root: string): Promise<OrzConfig>;
/**
 * 設定定義ヘルパー（型推論用）
 *
 * @example
 * ```ts
 * // orz.config.ts
 * export default defineConfig({
 *   adapter: 'vercel',
 *   plugins: ['@orz/plugin-firebase-auth'],
 *   build: {
 *     sourcemap: true
 *   }
 * });
 * ```
 */
export declare function defineConfig(config: OrzConfig): OrzConfig;
/**
 * 環境変数を読み込む
 */
export declare function loadEnv(mode: string, root?: string, prefix?: string | string[]): Record<string, string>;
export { defaultConfig, defaultBuildConfig, defaultServerConfig };
//# sourceMappingURL=loader.d.ts.map