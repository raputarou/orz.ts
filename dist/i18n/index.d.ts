/**
 * orz.ts i18n - Internationalization
 *
 * 国際化・多言語対応
 */
export type Locale = string;
export type TranslationKey = string;
export interface TranslationDictionary {
    [key: string]: string | TranslationDictionary;
}
export interface I18nConfig {
    defaultLocale: Locale;
    supportedLocales: Locale[];
    fallbackLocale?: Locale;
    loadPath?: string;
    interpolation?: {
        prefix?: string;
        suffix?: string;
    };
}
export interface I18nState {
    locale: Locale;
    translations: Map<Locale, TranslationDictionary>;
    isLoading: boolean;
}
export interface TranslateOptions {
    defaultValue?: string;
    count?: number;
    params?: Record<string, string | number>;
}
declare class I18nManager {
    private config;
    private state;
    private listeners;
    constructor(config: I18nConfig);
    /**
     * ブラウザの言語を検出
     */
    private detectLocale;
    /**
     * ロケールを変更
     */
    setLocale(locale: Locale): Promise<void>;
    /**
     * 翻訳ファイルをロード
     */
    loadTranslations(locale: Locale): Promise<void>;
    /**
     * 翻訳を追加（プログラム的に）
     */
    addTranslations(locale: Locale, translations: TranslationDictionary): void;
    private mergeDeep;
    /**
     * 翻訳を取得
     */
    t(key: TranslationKey, options?: TranslateOptions): string;
    private getNestedValue;
    private escapeRegex;
    /**
     * 現在のロケール
     */
    getLocale(): Locale;
    /**
     * ローディング状態
     */
    isLoading(): boolean;
    /**
     * 状態を購読
     */
    subscribe(listener: (state: I18nState) => void): () => void;
    private notifyListeners;
}
/**
 * i18n を初期化
 */
export declare function initI18n(config: I18nConfig): I18nManager;
/**
 * i18n インスタンスを取得
 */
export declare function getI18n(): I18nManager;
/**
 * 翻訳フック
 */
export declare function useTranslation(): {
    t: (key: TranslationKey, options?: TranslateOptions) => string;
    locale: Locale;
    setLocale: (locale: Locale) => Promise<void>;
    isLoading: boolean;
};
/**
 * ロケールのみを取得するフック
 */
export declare function useLocale(): [Locale, (locale: Locale) => Promise<void>];
/**
 * 数値のフォーマット
 */
export declare function formatNumber(num: number, locale?: Locale): string;
/**
 * 日付のフォーマット
 */
export declare function formatDate(date: Date | number, locale?: Locale, options?: Intl.DateTimeFormatOptions): string;
/**
 * 通貨のフォーマット
 */
export declare function formatCurrency(amount: number, currency: string, locale?: Locale): string;
/**
 * 相対時間のフォーマット
 */
export declare function formatRelativeTime(date: Date | number, locale?: Locale): string;
export {};
//# sourceMappingURL=index.d.ts.map