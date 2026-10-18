import { i18n } from "@lingui/core";
import { messages as viMessages } from "../locales/vi/messages.po";
import { messages as enMessages } from "../locales/en/messages.po";

export const LOCALES = ["vi", "en"];
const STORAGE_KEY = "locale-pref";

i18n.load({ vi: viMessages, en: enMessages });

function savedLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LOCALES.indexOf(saved) !== -1) return saved;
  } catch (e) {}
  return "vi";
}

export function activateLocale(next) {
  if (LOCALES.indexOf(next) === -1) return;
  i18n.activate(next);
  try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
}

i18n.activate(savedLocale());

export { i18n };
