import { useTranslation } from "react-i18next"
import { SUPPORTED_LANGUAGES, RTL_LANGUAGES } from "../i18n"

/**
 * Applies the correct reading direction to the document root whenever the
 * language changes. Arabic and Urdu are RTL — everything else is LTR.
 */
export function applyDirection(langCode) {
  const dir = RTL_LANGUAGES.includes(langCode) ? "rtl" : "ltr"
  document.documentElement.dir = dir
  document.documentElement.lang = langCode
}

export function LanguageSwitcher({ onChange }) {
  const { i18n } = useTranslation()

  const handleChange = (e) => {
    const code = e.target.value
    i18n.changeLanguage(code)
    applyDirection(code)
    onChange?.(code)
  }

  return (
    <select
      value={i18n.language}
      onChange={handleChange}
      aria-label="Language"
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.nativeLabel}
        </option>
      ))}
    </select>
  )
}
