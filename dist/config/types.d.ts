/**
 * orz.ts Configuration Types
 *
 * 設定ファイルの型定義
 */
/**
 * ルーティングモード
 * - mvc: MVC分離型ディレクトリ構造
 * - dispersion: コンポーネント内分散ルーティング
 */
export type RouteMode = 'mvc' | 'dispersion';
/**
 * 同期モード
 * - proxy: プロキシ・ストア（Signal Bridge）
 * - controller: サーバー主導型VDOMパッチ
 */
export type SyncMode = 'proxy' | 'controller';
/**
 * 認証モード
 * - self-sovereign: 自己主権型アイデンティティ
 * - firebase: Firebase Auth
 * - supabase: Supabase Auth
 * - auth0: Auth0
 * - clerk: Clerk
 * - cognito: AWS Cognito
 * - custom: カスタム実装
 */
export type AuthMode = 'self-sovereign' | 'firebase' | 'supabase' | 'auth0' | 'clerk' | 'cognito' | 'custom';
/**
 * データベースドライバー
 */
export type DatabaseDriver = 'indexeddb' | 'sqlite-wasm' | 'pglite' | 'postgresql' | 'mysql' | 'supabase' | 'planetscale' | 'turso';
/**
 * デプロイターゲット
 */
export type DeployTarget = 'vercel' | 'cloudflare' | 'netlify' | 'node' | 'static' | 'docker';
/**
 * orz.json 設定インターフェース
 */
export interface OrzJsonConfig {
    /** ルーティングモード */
    route?: RouteMode;
    /** 同期モード */
    sync?: SyncMode;
    /** 認証モード */
    auth?: AuthMode;
    /** BFF設定 */
    bff?: {
        /** 呼び出しモード: auto=自動検出, manual=手動指定 */
        call?: 'auto' | 'manual';
        /** BFFディレクトリ */
        directories?: string[];
    };
    /** サービスメッシュ設定 */
    mesh?: {
        enabled?: boolean;
        config?: string;
    };
    /** マスターデータ形式 */
    master_data?: 'json' | 'sql_dump' | 'csv';
    /** データベース設定 */
    database?: {
        driver?: DatabaseDriver;
        url?: string;
    };
    /** PWA設定 */
    pwa?: {
        enabled?: boolean;
        manifest?: string;
    };
    /** i18n設定 */
    i18n?: {
        defaultLocale?: string;
        locales?: string[];
        directory?: string;
    };
}
/**
 * プラグイン設定
 */
export interface PluginConfig {
    name: string;
    options?: Record<string, unknown>;
}
/**
 * ビルド設定
 */
export interface BuildConfig {
    /** 出力ディレクトリ */
    outDir?: string;
    /** ソースマップ生成 */
    sourcemap?: boolean;
    /** 圧縮 */
    minify?: boolean;
    /** ターゲットブラウザ */
    target?: string | string[];
    /** 外部依存除外 */
    external?: string[];
    /** コード分割 */
    splitting?: boolean;
}
/**
 * 開発サーバー設定
 */
export interface ServerConfig {
    /** ポート */
    port?: number;
    /** ホスト */
    host?: string | boolean;
    /** HTTPS */
    https?: boolean | {
        key?: string;
        cert?: string;
    };
    /** プロキシ設定 */
    proxy?: Record<string, string | {
        target: string;
        changeOrigin?: boolean;
        rewrite?: (path: string) => string;
    }>;
    /** HMR */
    hmr?: boolean | {
        overlay?: boolean;
    };
}
/**
 * orz.config.ts メイン設定インターフェース
 */
export interface OrzConfig {
    /** デプロイターゲット */
    adapter?: DeployTarget | (() => unknown);
    /** プラグイン */
    plugins?: (PluginConfig | string)[];
    /** ビルド設定 */
    build?: BuildConfig;
    /** 開発サーバー設定 */
    server?: ServerConfig;
    /** エイリアス */
    alias?: Record<string, string>;
    /** 環境変数プレフィックス */
    envPrefix?: string | string[];
    /** orz.json設定（インライン指定も可能） */
    orz?: OrzJsonConfig;
    /** カスタム設定 */
    [key: string]: unknown;
}
/**
 * デフォルト設定
 */
export declare const defaultConfig: Required<OrzJsonConfig>;
/**
 * デフォルトビルド設定
 */
export declare const defaultBuildConfig: Required<BuildConfig>;
/**
 * デフォルトサーバー設定
 */
export declare const defaultServerConfig: Required<ServerConfig>;
//# sourceMappingURL=types.d.ts.map