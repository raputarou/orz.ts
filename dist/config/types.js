/**
 * orz.ts Configuration Types
 *
 * 設定ファイルの型定義
 */
// ========================================
// Default Configuration
// ========================================
/**
 * デフォルト設定
 */
export const defaultConfig = {
    route: 'mvc',
    sync: 'proxy',
    auth: 'self-sovereign',
    bff: {
        call: 'auto',
        directories: ['bff', 'server'],
    },
    mesh: {
        enabled: false,
    },
    master_data: 'json',
    database: {
        driver: 'indexeddb',
    },
    pwa: {
        enabled: false,
    },
    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
        directory: 'locales',
    },
};
/**
 * デフォルトビルド設定
 */
export const defaultBuildConfig = {
    outDir: 'dist',
    sourcemap: true,
    minify: true,
    target: 'es2022',
    external: [],
    splitting: true,
};
/**
 * デフォルトサーバー設定
 */
export const defaultServerConfig = {
    port: 3000,
    host: 'localhost',
    https: false,
    proxy: {},
    hmr: true,
};
//# sourceMappingURL=types.js.map