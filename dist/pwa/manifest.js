/**
 * orz.ts PWA - Manifest Generator
 *
 * Web App Manifest の生成
 */
// ========================================
// Manifest Generator
// ========================================
/**
 * Web App Manifest を生成
 */
export function generateManifest(config) {
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
function generateDefaultIcons() {
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
let deferredPrompt = null;
/**
 * インストールプロンプトイベントをキャプチャ
 */
export function captureInstallPrompt() {
    if (typeof window === 'undefined')
        return;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
    });
}
/**
 * インストール可能かどうかを確認
 */
export function isInstallable() {
    return deferredPrompt !== null;
}
/**
 * インストールプロンプトを表示
 */
export async function showInstallPrompt() {
    if (!deferredPrompt) {
        console.warn('[orz.ts] Install prompt not available');
        return false;
    }
    try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        return outcome === 'accepted';
    }
    catch (error) {
        console.error('[orz.ts] Install prompt failed:', error);
        return false;
    }
}
/**
 * スタンドアロンモードかどうかを確認
 */
export function isStandalone() {
    if (typeof window === 'undefined')
        return false;
    return (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true);
}
// ========================================
// Manifest Link Helper
// ========================================
/**
 * Manifest リンクをheadに追加
 */
export function addManifestLink(href = '/manifest.json') {
    if (typeof document === 'undefined')
        return;
    const existing = document.querySelector('link[rel="manifest"]');
    if (existing)
        return;
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = href;
    document.head.appendChild(link);
}
/**
 * Theme Color メタタグを設定
 */
export function setThemeColor(color) {
    if (typeof document === 'undefined')
        return;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = color;
}
//# sourceMappingURL=manifest.js.map