/**
 * orz.ts Vite Plugin
 * 
 * Vite統合プラグイン
 */

import type { Plugin as VitePlugin, ResolvedConfig, ViteDevServer } from 'vite';
import { loadConfig, type LoadedConfig } from '../config/loader.js';
import { PluginManager } from '../plugins/plugin.js';

// ========================================
// Types
// ========================================

export interface OrzVitePluginOptions {
    /** プロジェクトルート */
    root?: string;
    /** 追加のViteプラグイン */
    plugins?: VitePlugin[];
}

// ========================================
// Main Plugin
// ========================================

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
export function orzVitePlugin(options: OrzVitePluginOptions = {}): VitePlugin[] {
    let config: LoadedConfig | null = null;
    let pluginManager: PluginManager | null = null;
    let viteConfig: ResolvedConfig | null = null;

    const mainPlugin: VitePlugin = {
        name: 'orz',
        enforce: 'pre',

        async config(userConfig, { command }) {
            const root = options.root || userConfig.root || process.cwd();
            config = await loadConfig(root);
            pluginManager = new PluginManager(
                config.orzConfig,
                root,
                command === 'serve'
            );

            await pluginManager.init();

            // Merge with orz config
            const buildConfig = config.orzConfig.build || {};

            return {
                root,
                resolve: {
                    alias: config.orzConfig.alias || {},
                },
                build: {
                    outDir: buildConfig.outDir || 'dist',
                    sourcemap: buildConfig.sourcemap ?? true,
                    minify: buildConfig.minify ?? true,
                    target: buildConfig.target || 'es2022',
                },
                server: {
                    port: config.orzConfig.server?.port || 3000,
                    host: config.orzConfig.server?.host || 'localhost',
                },
            };
        },

        configResolved(resolvedConfig) {
            viteConfig = resolvedConfig;
        },

        async buildStart() {
            if (pluginManager && config) {
                await pluginManager.runHook('buildStart', {
                    config: config.orzConfig,
                    root: config.root,
                    isDev: viteConfig?.command === 'serve',
                    invokePlugin: pluginManager.invokePlugin.bind(pluginManager),
                });
            }
        },

        async buildEnd() {
            // Build end hook is called in closeBundle
        },

        async closeBundle() {
            if (pluginManager && config && viteConfig) {
                await pluginManager.runHook('buildEnd', {
                    config: config.orzConfig,
                    root: config.root,
                    isDev: false,
                    invokePlugin: pluginManager.invokePlugin.bind(pluginManager),
                }, {
                    outDir: viteConfig.build.outDir,
                    files: [],
                });
            }
        },

        configureServer(server: ViteDevServer) {
            // Add middleware for RPC handling
            server.middlewares.use('/__orz_rpc', async (req, res, next) => {
                if (req.method === 'POST') {
                    let body = '';
                    req.on('data', chunk => body += chunk);
                    req.on('end', async () => {
                        try {
                            const request = JSON.parse(body);
                            // TODO: Handle RPC request in dev mode
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({
                                id: request.id,
                                result: null,
                                error: 'Dev mode RPC not yet implemented',
                            }));
                        } catch (error) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: 'Failed to parse request' }));
                        }
                    });
                } else {
                    next();
                }
            });
        },

        async transform(code, id) {
            // Transform .orz files
            if (id.endsWith('.orz')) {
                return transformOrzFile(code, id);
            }

            // Transform decorator usage
            if ((id.endsWith('.ts') || id.endsWith('.tsx')) && code.includes('@Controller')) {
                return transformControllerFile(code, id);
            }

            // Run plugin transforms
            if (pluginManager) {
                const result = await pluginManager.runTransformHook(code, id);
                return result;
            }

            return null;
        },

        async handleHotUpdate({ file, server }) {
            // Handle HMR for controller files
            if (file.includes('/controllers/') || file.includes('/bff/')) {
                console.log(`[orz] Controller updated: ${file}`);
                // Notify client to refresh
                server.ws.send({
                    type: 'custom',
                    event: 'orz:controller-update',
                    data: { file },
                });
            }
        },
    };

    // React refresh integration
    const reactPlugin: VitePlugin = {
        name: 'orz:react',
        enforce: 'post',

        transform(code, id) {
            // Handle JSX/TSX with orz hooks
            if (id.endsWith('.tsx') || id.endsWith('.jsx')) {
                // Auto-import orz hooks if used
                if (code.includes('useStore') && !code.includes("from 'orz.ts")) {
                    const importStatement = "import { useStore } from 'orz.ts/react';\n";
                    return importStatement + code;
                }
            }
            return null;
        },
    };

    return [mainPlugin, reactPlugin, ...(options.plugins || [])];
}

// ========================================
// Transform Helpers
// ========================================

function transformOrzFile(code: string, id: string): { code: string } {
    // Basic .orz template transformation
    // TODO: Implement full parser

    const lines = code.split('\n');
    const output: string[] = [];

    let inScript = false;
    let scriptContent = '';
    let templateContent = '';

    for (const line of lines) {
        if (line.trim() === '<script>') {
            inScript = true;
            continue;
        }
        if (line.trim() === '</script>') {
            inScript = false;
            continue;
        }

        if (inScript) {
            scriptContent += line + '\n';
        } else if (!line.trim().startsWith('<style')) {
            templateContent += line + '\n';
        }
    }

    // Generate component
    output.push(`// Generated from ${id}`);
    output.push(scriptContent);
    output.push(`
export default function OrzComponent() {
  return (
    <>
      ${templateContent.trim()}
    </>
  );
}
    `);

    return { code: output.join('\n') };
}

function transformControllerFile(code: string, _id: string): { code: string } | null {
    // Add reflect-metadata import if using decorators
    if (!code.includes('reflect-metadata')) {
        const metadataImport = "import 'reflect-metadata';\n";

        // Insert after other imports
        const lastImportIndex = code.lastIndexOf('import ');
        if (lastImportIndex !== -1) {
            const lineEnd = code.indexOf('\n', lastImportIndex);
            return {
                code: code.slice(0, lineEnd + 1) + metadataImport + code.slice(lineEnd + 1),
            };
        }

        return { code: metadataImport + code };
    }

    return null;
}

// ========================================
// Default Export
// ========================================

export default orzVitePlugin;
