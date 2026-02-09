/**
 * orz.ts PWA - Manifest Generator
 *
 * Web App Manifest の生成
 */
export interface ManifestConfig {
    name: string;
    shortName?: string;
    description?: string;
    startUrl?: string;
    display?: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser';
    orientation?: 'any' | 'natural' | 'landscape' | 'portrait';
    themeColor?: string;
    backgroundColor?: string;
    icons?: ManifestIcon[];
    screenshots?: ManifestScreenshot[];
    categories?: string[];
    shortcuts?: ManifestShortcut[];
    shareTarget?: ManifestShareTarget;
    lang?: string;
    dir?: 'ltr' | 'rtl' | 'auto';
}
export interface ManifestIcon {
    src: string;
    sizes: string;
    type?: string;
    purpose?: 'any' | 'maskable' | 'monochrome';
}
export interface ManifestScreenshot {
    src: string;
    sizes: string;
    type?: string;
    label?: string;
}
export interface ManifestShortcut {
    name: string;
    shortName?: string;
    description?: string;
    url: string;
    icons?: ManifestIcon[];
}
export interface ManifestShareTarget {
    action: string;
    method?: 'GET' | 'POST';
    enctype?: string;
    params: {
        title?: string;
        text?: string;
        url?: string;
        files?: Array<{
            name: string;
            accept: string[];
        }>;
    };
}
/**
 * Web App Manifest を生成
 */
export declare function generateManifest(config: ManifestConfig): string;
/**
 * インストールプロンプトイベントをキャプチャ
 */
export declare function captureInstallPrompt(): void;
/**
 * インストール可能かどうかを確認
 */
export declare function isInstallable(): boolean;
/**
 * インストールプロンプトを表示
 */
export declare function showInstallPrompt(): Promise<boolean>;
/**
 * スタンドアロンモードかどうかを確認
 */
export declare function isStandalone(): boolean;
/**
 * Manifest リンクをheadに追加
 */
export declare function addManifestLink(href?: string): void;
/**
 * Theme Color メタタグを設定
 */
export declare function setThemeColor(color: string): void;
//# sourceMappingURL=manifest.d.ts.map