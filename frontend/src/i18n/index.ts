import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ms from "./locales/ms.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ms: { translation: ms },
  },
  lng: localStorage.getItem("user_language") || "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
