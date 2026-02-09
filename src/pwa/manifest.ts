/**
 * orz.ts PWA - Manifest Generator
 * 
 * Web App Manifest の生成
 */

// ========================================
// Types
// ========================================

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
        files?: Array<{ name: string; accept: string[] }>;
    };
}

// ========================================
// Manifest Generator
// ========================================

/**
 * Web App Manifest を生成
 */
export function generateManifest(config: ManifestConfig): string {
    const manifest = {
        name: config.name,
        short_name: config.shortName || config.name,
        description: config.description,
        start_url: config.startUrl || '/',
        display: config.display || 'standalone',
        orientation: config.orientation || 'any',
        theme_color: config.themeColor || '#000000',
        background_color: config.backgroundColor || '#ffffff',
        icons: config.icons || generateDefaultIcons(),
        screenshots: config.screenshots,
        categories: config.categories,
        shortcuts: config.shortcuts?.map(s => ({
            name: s.name,
            short_name: s.shortName,
            description: s.description,
            url: s.url,
            icons: s.icons,
        })),
        share_target: config.shareTarget ? {
            action: config.shareTarget.action,
            method: config.shareTarget.method || 'GET',
            enctype: config.shareTarget.enctype,
            params: config.shareTarget.params,
        } : undefined,
        lang: config.lang,
        dir: config.dir,
    };

    // Remove undefined values
    const cleanManifest = JSON.parse(JSON.stringify(manifest));

    return JSON.stringify(cleanManifest, null, 2);
}

/**
 * デフォルトアイコンセットを生成
 */
function generateDefaultIcons(): ManifestIcon[] {
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    return sizes.map(size => ({
        src: `/icons/icon-${size}x${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose: 'any',
    }));
}

// ========================================
// Install Prompt
// ========================================

let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * インストールプロンプトイベントをキャプチャ
 */
export function captureInstallPrompt(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
    });
}

/**
 * インストール可能かどうかを確認
 */
export function isInstallable(): boolean {
    return deferredPrompt !== null;
}

/**
 * インストールプロンプトを表示
 */
export async function showInstallPrompt(): Promise<boolean> {
    if (!deferredPrompt) {
        console.warn('[orz.ts] Install prompt not available');
        return false;
    }

    try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        return outcome === 'accepted';
    } catch (error) {
        console.error('[orz.ts] Install prompt failed:', error);
        return false;
    }
}

/**
 * スタンドアロンモードかどうかを確認
 */
export function isStandalone(): boolean {
    if (typeof window === 'undefined') return false;

    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
}

// ========================================
// Manifest Link Helper
// ========================================

/**
 * Manifest リンクをheadに追加
 */
export function addManifestLink(href: string = '/manifest.json'): void {
    if (typeof document === 'undefined') return;

    const existing = document.querySelector('link[rel="manifest"]');
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = href;
    document.head.appendChild(link);
}

/**
 * Theme Color メタタグを設定
 */
export function setThemeColor(color: string): void {
    if (typeof document === 'undefined') return;

    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = color;
}
