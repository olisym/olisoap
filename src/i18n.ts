import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Übersetzbare Texte: Der deutsche Text ist selbst der Schlüssel, damit der Code lesbar bleibt.
//   const { t } = useTranslation()   →   t('Neu laden'), t('Stand {{date}}', { date })
// Außerhalb von Komponenten: i18n.t(…). Für eine neue Sprache später die Schlüssel mit einem Standardwerkzeug
// (z. B. i18next-cli extract) in eine JSON-Datei ziehen und übersetzen; fehlt eine Übersetzung, gilt Deutsch.
// Zahlen und Daten nicht in Texte einbauen, sondern mit Intl formatieren (format.ts) und einsetzen.
void i18n.use(initReactI18next).init({
  lng: 'de',
  fallbackLng: 'de',
  resources: { de: { translation: {} } },
  // Ganze Sätze als Schlüssel: Punkt und Doppelpunkt sind normaler Text, keine Trennzeichen
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
})

export default i18n
