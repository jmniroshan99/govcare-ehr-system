import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import si from "./locales/si.json";
import ta from "./locales/ta.json";

const LANGUAGE_STORAGE_KEY = "govcare-language";
export const supportedLanguages = ["en", "si", "ta"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageOptions: Array<{ code: SupportedLanguage; label: string; nativeLabel: string; icon: string }> = [
  { code: "en", label: "English", nativeLabel: "English", icon: "EN" },
  { code: "si", label: "Sinhala", nativeLabel: "සිංහල", icon: "සි" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", icon: "த" },
];

function getStoredLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return supportedLanguages.includes(stored as SupportedLanguage) ? (stored as SupportedLanguage) : "en";
}

i18n.use(initReactI18next).init({
  fallbackLng: "en",
  lng: getStoredLanguage(),
  interpolation: { escapeValue: false },
  returnNull: false,
  resources: {
    en: { translation: en },
    si: { translation: si },
    ta: { translation: ta },
  },
});

i18n.on("languageChanged", (language) => {
  if (typeof window === "undefined") return;
  const normalized = supportedLanguages.includes(language as SupportedLanguage) ? language : "en";
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  document.documentElement.lang = normalized;
});

document.documentElement.lang = getStoredLanguage();

export default i18n;
