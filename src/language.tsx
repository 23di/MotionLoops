import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SelectControl, type ControlMeta } from "dialkit";
import { isLanguagePreference, languageNames, languageStorageKey, locales, resolveLocale, translate, translateMessage, type LanguagePreference, type Locale } from "./i18n";

function readPreference(): LanguagePreference {
  try {
    const saved = localStorage.getItem(languageStorageKey);
    if (isLanguagePreference(saved)) return saved;
  } catch { /* Figma may disable iframe storage. */ }
  return "auto";
}
function systemLocale(): Locale {
  return resolveLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
}
const LanguageContext = createContext({
  locale: "en" as Locale,
  automaticLocale: "en" as Locale,
  preference: "auto" as LanguagePreference,
  setPreference: (_preference: LanguagePreference) => {},
});
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [preference, updatePreference] = useState(readPreference);
  const [automaticLocale, setAutomaticLocale] = useState(systemLocale);
  const locale = preference === "auto" ? automaticLocale : preference;
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    const languageChanged = () => setAutomaticLocale(systemLocale());
    const storageChanged = (event: StorageEvent) => {
      if (event.key === languageStorageKey || event.key === null) updatePreference(readPreference());
    };
    window.addEventListener("languagechange", languageChanged);
    window.addEventListener("storage", storageChanged);
    return () => {
      window.removeEventListener("languagechange", languageChanged);
      window.removeEventListener("storage", storageChanged);
    };
  }, []);
  const value = useMemo(() => ({ locale, automaticLocale, preference, setPreference: (next: LanguagePreference) => {
    updatePreference(next);
    try { localStorage.setItem(languageStorageKey, next); } catch { /* Session-only when storage is unavailable. */ }
  } }), [locale, automaticLocale, preference]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext); }
export function useTranslation() {
  const { locale } = useLanguage();
  return useCallback((text: string, params?: Record<string, string | number>) => translate(text, locale, params), [locale]);
}
export function useMessageTranslation() {
  const { locale } = useLanguage();
  return useCallback((message: string) => translateMessage(message, locale), [locale]);
}
export function LanguageSelect() {
  const { automaticLocale, preference, setPreference } = useLanguage();
  const t = useTranslation();
  return <div className="orbit-language-control">
    <SelectControl label={t("Language")} value={preference}
      options={[{ value: "auto", label: `${t("Automatic")} · ${languageNames[automaticLocale]}` },
        ...locales.map(value => ({ value, label: languageNames[value] }))]}
      onChange={value => { if (isLanguagePreference(value)) setPreference(value); }} />
  </div>;
}
export function localizeControl(control: ControlMeta, t: ReturnType<typeof useTranslation>): ControlMeta {
  return { ...control, label: t(control.label),
    ...(control.placeholder ? { placeholder: t(control.placeholder) } : {}),
    ...(control.options ? { options: control.options.map(option => typeof option === "string"
      ? { value: option, label: t(option.replace(/\b\w/g, character => character.toUpperCase())) } : { ...option, label: t(option.label) }) } : {}),
  };
}
