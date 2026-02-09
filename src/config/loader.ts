/**
 * orz.ts Configuration Loader
 * 
 * 設定ファイルの読み込みと解析
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { pathToFileURL } from 'url';
import type { OrzJsonConfig, OrzConfig, BuildConfig, ServerConfig } from './types.js';
import { defaultConfig, defaultBuildConfig, defaultServerConfig } from './types.js';

// ========================================
// Types
// ========================================

export interface LoadedConfig {
    orzJson: Required<OrzJsonConfig>;
    orzConfig: OrzConfig;
    root: string;
}

// ========================================
// Config Loader
// ========================================

/**
 * 設定ファイルを読み込む
 * 
 * @param root プロジェクトルートディレクトリ
 * @returns 読み込まれた設定
 */
export async function loadConfig(root: string = process.cwd()): Promise<LoadedConfig> {
    const orzJson = loadOrzJson(root);
    const orzConfig = await loadOrzConfig(root);

    // Merge inline orz config if present
    const mergedOrzJson = mergeConfig(orzJson, orzConfig.orz || {});

    return {
        orzJson: mergedOrzJson as Required<OrzJsonConfig>,
        orzConfig,
        root,
    };
}

/**
 * orz.json を読み込む
 */
export function loadOrzJson(root: string): Required<OrzJsonConfig> {
    const jsonPath = resolve(root, 'orz.json');
    const yamlPath = resolve(root, 'orz.yaml');
    const ymlPath = resolve(root, 'orz.yml');

    let config: OrzJsonConfig = {};

    if (existsSync(jsonPath)) {
        try {
            const content = readFileSync(jsonPath, 'utf-8');
            config = JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to parse orz.json: ${error}`);
        }
    } else if (existsSync(yamlPath) || existsSync(ymlPath)) {
        // YAML support would require additional dependency
        console.warn('[orz] YAML config detected but not yet supported. Using defaults.');
    }

    return mergeConfig(defaultConfig, config) as Required<OrzJsonConfig>;
}

/**
 * orz.config.ts を読み込む
 */
export async function loadOrzConfig(root: string): Promise<OrzConfig> {
    const extensions = ['.ts', '.mts', '.js', '.mjs'];

    for (const ext of extensions) {
        const configPath = resolve(root, `orz.config${ext}`);

        if (existsSync(configPath)) {
            try {
                // Dynamic import for ES modules
                const fileUrl = pathToFileURL(configPath).href;
                const module = await import(fileUrl);
                const config = module.default || module;

                return normalizeConfig(config);
            } catch (error) {
                console.warn(`[orz] Failed to load orz.config${ext}:`, error);
            }
        }
    }

    return {};
}

// ========================================
// Config Helpers
// ========================================

/**
 * 設定をマージ
 */
function mergeConfig<T extends object>(defaults: T, overrides: Partial<T>): T {
    const result = { ...defaults };

    for (const key of Object.keys(overrides) as (keyof T)[]) {
        const value = overrides[key];

        if (value === undefined) continue;

        if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            typeof result[key] === 'object' &&
            result[key] !== null
        ) {
            result[key] = mergeConfig(
                result[key] as object,
                value as object
            ) as T[keyof T];
        } else {
            result[key] = value as T[keyof T];
        }
    }

    return result;
}

/**
 * 設定を正規化
 */
function normalizeConfig(config: OrzConfig): OrzConfig {
    return {
        ...config,
        build: config.build ? mergeConfig(defaultBuildConfig, config.build) : defaultBuildConfig,
        server: config.server ? mergeConfig(defaultServerConfig, config.server) : defaultServerConfig,
    };
}

// ========================================
// Config Definition Helper
// ========================================

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
export function defineConfig(config: OrzConfig): OrzConfig {
    return config;
}

// ========================================
// Environment Helpers
// ========================================

/**
 * 環境変数を読み込む
 */
export function loadEnv(
    mode: string,
    root: string = process.cwd(),
    prefix: string | string[] = 'ORZ_'
): Record<string, string> {
    const prefixes = Array.isArray(prefix) ? prefix : [prefix];
    const env: Record<string, string> = {};

    // Load from process.env
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined && prefixes.some(p => key.startsWith(p))) {
            env[key] = value;
        }
    }

    // Load .env files
    const envFiles = [
        `.env`,
        `.env.local`,
        `.env.${mode}`,
        `.env.${mode}.local`,
    ];

    for (const file of envFiles) {
        const filePath = resolve(root, file);
        if (existsSync(filePath)) {
            try {
                const content = readFileSync(filePath, 'utf-8');
                const parsed = parseEnv(content);

                for (const [key, value] of Object.entries(parsed)) {
                    if (prefixes.some(p => key.startsWith(p))) {
                        env[key] = value;
                    }
                }
            } catch (error) {
                console.warn(`[orz] Failed to load ${file}:`, error);
            }
        }
    }

    return env;
}

/**
 * .env ファイルをパース
 */
function parseEnv(content: string): Record<string, string> {
    const env: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;

        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();

            // Remove quotes
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            env[key] = value;
        }
    }

    return env;
}

// ========================================
// Exports
// ========================================

export { defaultConfig, defaultBuildConfig, defaultServerConfig };
