import { useLingui } from "@lingui/react/macro";
import { activateLocale } from "../lib/i18n.js";

export default function LocaleToggle() {
  const { i18n, t } = useLingui();
  const current = i18n.locale;
  const next = current === "vi" ? "en" : "vi";

  return (
    <button
      className="btn ghost lang"
      onClick={() => activateLocale(next)}
      title={next === "en" ? t`Chuyển sang tiếng Anh` : t`Chuyển sang tiếng Việt`}
    >
      {current.toUpperCase()}
    </button>
  );
}
