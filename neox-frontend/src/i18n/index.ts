import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import az from "./az.json";
import tr from "./tr.json";
import en from "./en.json";
import ru from "./ru.json";
import es from "./es.json";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      az: { translation: az },
      tr: { translation: tr },
      en: { translation: en },
      ru: { translation: ru },
      es: { translation: es },
    },
    lng: "az",          // default dil
    fallbackLng: "az",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
