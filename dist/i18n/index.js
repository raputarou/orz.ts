/**
 * orz.ts i18n - Internationalization
 *
 * 国際化・多言語対応
 */
import { useState, useEffect, useCallback } from 'react';
// ========================================
// I18n Manager
// ========================================
class I18nManager {
    config;
    state;
    listeners = new Set();
    constructor(config) {
        this.config = {
            fallbackLocale: config.defaultLocale,
            loadPath: '/locales/{{locale}}.json',
            interpolation: { prefix: '{{', suffix: '}}' },
            ...config,
        };
        this.state = {
            locale: this.detectLocale(),
            translations: new Map(),
            isLoading: false,
        };
        // Load initial locale
        this.loadTranslations(this.state.locale);
    }
    /**
     * ブラウザの言語を検出
     */
    detectLocale() {
        if (typeof navigator === 'undefined') {
            return this.config.defaultLocale;
        }
        // Check localStorage
        const stored = localStorage.getItem('orz_locale');
        if (stored && this.config.supportedLocales.includes(stored)) {
            return stored;
        }
        // Check browser language
        const browserLang = navigator.language;
        if (this.config.supportedLocales.includes(browserLang)) {
            return browserLang;
        }
        // Check short code (e.g., 'en' from 'en-US')
        const shortCode = browserLang.split('-')[0];
        const match = this.config.supportedLocales.find(l => l.startsWith(shortCode));
        if (match) {
            return match;
        }
        return this.config.defaultLocale;
    }
    /**
     * ロケールを変更
     */
    async setLocale(locale) {
        if (!this.config.supportedLocales.includes(locale)) {
            console.warn(`[orz.ts i18n] Unsupported locale: ${locale}`);
            return;
        }
        await this.loadTranslations(locale);
        this.state.locale = locale;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('orz_locale', locale);
        }
        this.notifyListeners();
    }
    /**
     * 翻訳ファイルをロード
     */
    async loadTranslations(locale) {
        if (this.state.translations.has(locale)) {
            return;
        }
        this.state.isLoading = true;
        this.notifyListeners();
        try {
            const path = this.config.loadPath.replace('{{locale}}', locale);
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load translations: ${response.status}`);
            }
            const translations = await response.json();
            this.state.translations.set(locale, translations);
        }
        catch (error) {
            console.error(`[orz.ts i18n] Failed to load ${locale}:`, error);
        }
        finally {
            this.state.isLoading = false;
            this.notifyListeners();
        }
    }
    /**
     * 翻訳を追加（プログラム的に）
     */
    addTranslations(locale, translations) {
        const existing = this.state.translations.get(locale) || {};
        this.state.translations.set(locale, this.mergeDeep(existing, translations));
        this.notifyListeners();
    }
    mergeDeep(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.mergeDeep(result[key] || {}, source[key]);
            }
            else {
                result[key] = source[key];
            }
        }
        return result;
    }
    /**
     * 翻訳を取得
     */
    t(key, options) {
        const translations = this.state.translations.get(this.state.locale);
        let value = this.getNestedValue(translations, key);
        // Fallback to fallback locale
        if (!value && this.config.fallbackLocale !== this.state.locale) {
            const fallback = this.state.translations.get(this.config.fallbackLocale);
            value = this.getNestedValue(fallback, key);
        }
        // Fallback to default value or key
        if (!value) {
            return options?.defaultValue || key;
        }
        // Handle pluralization
        if (options?.count !== undefined && typeof value === 'object') {
            const plural = value;
            if (options.count === 0 && plural.zero) {
                value = plural.zero;
            }
            else if (options.count === 1 && plural.one) {
                value = plural.one;
            }
            else if (plural.other) {
                value = plural.other;
            }
        }
        // Interpolation
        if (options?.params && typeof value === 'string') {
            const prefix = this.config.interpolation.prefix ?? '{{';
            const suffix = this.config.interpolation.suffix ?? '}}';
            for (const [param, paramValue] of Object.entries(options.params)) {
                value = value.replace(new RegExp(`${this.escapeRegex(prefix)}${param}${this.escapeRegex(suffix)}`, 'g'), String(paramValue));
            }
        }
        // Replace count placeholder
        if (options?.count !== undefined && typeof value === 'string') {
            const prefix = this.config.interpolation.prefix ?? '{{';
            const suffix = this.config.interpolation.suffix ?? '}}';
            value = value.replace(new RegExp(`${this.escapeRegex(prefix)}count${this.escapeRegex(suffix)}`, 'g'), String(options.count));
        }
        return value;
    }
    getNestedValue(obj, key) {
        if (!obj)
            return null;
        const parts = key.split('.');
        let current = obj;
        for (const part of parts) {
            if (current && typeof current === 'object') {
                current = current[part];
            }
            else {
                return null;
            }
        }
        return typeof current === 'string' ? current : null;
    }
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    /**
     * 現在のロケール
     */
    getLocale() {
        return this.state.locale;
    }
    /**
     * ローディング状態
     */
    isLoading() {
        return this.state.isLoading;
    }
    /**
     * 状態を購読
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    notifyListeners() {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }
}
// ========================================
// Global Instance
// ========================================
let i18n = null;
/**
 * i18n を初期化
 */
export function initI18n(config) {
    i18n = new I18nManager(config);
    return i18n;
}
/**
 * i18n インスタンスを取得
 */
export function getI18n() {
    if (!i18n) {
        throw new Error('[orz.ts i18n] Not initialized. Call initI18n() first.');
    }
    return i18n;
}
// ========================================
// React Hooks
// ========================================
/**
 * 翻訳フック
 */
export function useTranslation() {
    const i18nInstance = getI18n();
    const [state, setState] = useState({
        locale: i18nInstance.getLocale(),
        isLoading: i18nInstance.isLoading(),
    });
    useEffect(() => {
        const unsubscribe = i18nInstance.subscribe((newState) => {
            setState({
                locale: newState.locale,
                isLoading: newState.isLoading,
            });
        });
        return unsubscribe;
    }, []);
    const t = useCallback((key, options) => {
        return i18nInstance.t(key, options);
    }, [state.locale]);
    const setLocale = useCallback(async (locale) => {
        await i18nInstance.setLocale(locale);
    }, []);
    return {
        t,
        locale: state.locale,
        setLocale,
        isLoading: state.isLoading,
    };
}
/**
 * ロケールのみを取得するフック
 */
export function useLocale() {
    const i18nInstance = getI18n();
    const [locale, setLocaleState] = useState(i18nInstance.getLocale());
    useEffect(() => {
        const unsubscribe = i18nInstance.subscribe((state) => {
            setLocaleState(state.locale);
        });
        return unsubscribe;
    }, []);
    const setLocale = useCallback(async (newLocale) => {
        await i18nInstance.setLocale(newLocale);
    }, []);
    return [locale, setLocale];
}
// ========================================
// Utilities
// ========================================
/**
 * 数値のフォーマット
 */
export function formatNumber(num, locale) {
    const l = locale || (i18n?.getLocale() ?? 'en');
    return new Intl.NumberFormat(l).format(num);
}
/**
 * 日付のフォーマット
 */
export function formatDate(date, locale, options) {
    const l = locale || (i18n?.getLocale() ?? 'en');
    return new Intl.DateTimeFormat(l, options).format(date);
}
/**
 * 通貨のフォーマット
 */
export function formatCurrency(amount, currency, locale) {
    const l = locale || (i18n?.getLocale() ?? 'en');
    return new Intl.NumberFormat(l, {
        style: 'currency',
        currency,
    }).format(amount);
}
/**
 * 相対時間のフォーマット
 */
export function formatRelativeTime(date, locale) {
    const l = locale || (i18n?.getLocale() ?? 'en');
    const now = Date.now();
    const timestamp = typeof date === 'number' ? date : date.getTime();
    const diff = timestamp - now;
    const diffSeconds = Math.round(diff / 1000);
    const diffMinutes = Math.round(diff / 60000);
    const diffHours = Math.round(diff / 3600000);
    const diffDays = Math.round(diff / 86400000);
    const rtf = new Intl.RelativeTimeFormat(l, { numeric: 'auto' });
    if (Math.abs(diffSeconds) < 60) {
        return rtf.format(diffSeconds, 'second');
    }
    else if (Math.abs(diffMinutes) < 60) {
        return rtf.format(diffMinutes, 'minute');
    }
    else if (Math.abs(diffHours) < 24) {
        return rtf.format(diffHours, 'hour');
    }
    else {
        return rtf.format(diffDays, 'day');
    }
}
//# sourceMappingURL=index.js.map