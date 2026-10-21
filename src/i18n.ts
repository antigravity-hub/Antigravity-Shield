/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import zh from "./locales/zh.json";
import zhTW from "./locales/zh-TW.json";
import ja from "./locales/ja.json";
import tr from "./locales/tr.json";
import vi from "./locales/vi.json";
import pt from "./locales/pt.json";
import ru from "./locales/ru.json";
import ko from "./locales/ko.json";
import ar from "./locales/ar.json";
import es from "./locales/es.json";
import my from "./locales/my.json";
import fa from "./locales/fa.json";

i18n
    // detect user language
    // learn more: https://github.com/i18next/i18next-browser-languagedetector
    .use(LanguageDetector)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
        resources: {
            en: {
                translation: en,
            },
            zh: {
                translation: zh,
            },
            "zh-TW": {
                translation: zhTW,
            },
            ja: {
                translation: ja,
            },
            tr: {
                translation: tr,
            },
            // Handling 'zh-CN' as 'zh'
            "zh-CN": {
                translation: zh,
            },
            vi: {
                translation: vi,
            },
            "vi-VN": {
                translation: vi,
            },
            pt: {
                translation: pt,
            },
            "pt-BR": {
                translation: pt,
            },
            ru: {
                translation: ru,
            },
            ko: {
                translation: ko,
            },
            ar: {
                translation: ar,
            },
            es: {
                translation: es,
            },
            "es-ES": {
                translation: es,
            },
            "es-MX": {
                translation: es,
            },
            my: {
                translation: my,
            },
            "ms": {
                translation: my,
            },
            "ms-MY": {
                translation: my,
            },
            fa: {
                translation: fa,
            },
            "fa-IR": {
                translation: fa,
            },
        },
        fallbackLng: "en",
        detection: {
            order: ["localStorage"],
            lookupLocalStorage: "i18nextLng",
            caches: ["localStorage"],
        },
        debug: false, // Set to true for development

        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
    });

// Universal RTL and Language Sync Helper
export const syncAppDirectionAndLanguage = (lng?: string) => {
    if (typeof document === 'undefined') return;
    const current = lng || i18n.language || 'en';
    const isRtl = current === 'ar' || current === 'fa' || current?.startsWith('fa-') || current?.startsWith('ar-');
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = current;
    if (isRtl) {
        document.documentElement.classList.add('rtl-layout');
        document.body?.classList.add('rtl-layout');
    } else {
        document.documentElement.classList.remove('rtl-layout');
        document.body?.classList.remove('rtl-layout');
    }
};

i18n.on('languageChanged', (lng) => {
    syncAppDirectionAndLanguage(lng);
});

// Sync on boot
if (typeof document !== 'undefined') {
    syncAppDirectionAndLanguage(i18n.language || 'en');
}

export default i18n;

