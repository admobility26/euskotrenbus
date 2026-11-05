import { useLanguage } from "./Language.jsx";
import { t, locale, getLanguage, headerAsset, translatedField } from "./i18n.js";
import React from 'react';
export default function LineDetails({
  line
}) {
  useLanguage();
  return <section className="line-details"><p><strong>{t(line.number)}</strong>{t(line.internalNumber ? ` · Nº interno ${line.internalNumber}` : ' · Identificador local: la tabla no indica código de concesión')}</p>{t((line.outbound || line.inbound) && <p><strong>{t("Ida:")}</strong> {t(line.outbound || 'No indicada')}{t(" \xB7 ")}<strong>{t("Vuelta:")}</strong> {t(line.inbound || 'No indicada')}</p>)}{t(line.variants.length > 0 ? <><strong>{t("Variantes de la tabla")}</strong><ul>{t(line.variants.map(v => <li key={v}>{t(v)}</li>))}</ul></> : <p>{t("La tabla no especifica variantes ni sentidos para este servicio.")}</p>)}</section>;
}
