import { useLanguage } from "./Language.jsx";
import { t, locale, getLanguage, headerAsset, translatedField } from "./i18n.js";
import React, { useState } from 'react';
export default function HazardAssignments({
  value = {},
  onChange,
  routes,
  currentRoute
}) {
  useLanguage();
  const [selected, setSelected] = useState([]),
    [query, setQuery] = useState(''),
    [mode, setMode] = useState('include');
  const visible = routes.filter(r => `${r.line} ${r.name} ${r.direction || ''} ${r.nameEu||''} ${t(r.direction||'')}`.toLowerCase().includes(query.toLowerCase()));
  const lines = [...new Set(visible.map(r => r.line))].sort((a, b) => a.localeCompare(b, undefined, {
    numeric: true
  }));
  const toggle = (ids, on) => setSelected(s => on ? [...new Set([...s, ...ids])] : s.filter(id => !ids.includes(id)));
  const apply = (ids, next) => {
    const updated = {
      ...value
    };
    for (const id of ids) {
      if (next === 'auto') delete updated[id];else updated[id] = next;
    }
    onChange(updated);
  };
  return <fieldset className="hazard-assignments"><legend>{t("Asignaci\xF3n por l\xEDnea y recorrido")}</legend><p>{t("Autom\xE1tico usa el GPX y el sentido. Incluir fuerza un aviso en el paso m\xE1s cercano del GPX, aunque no coincida el sentido o el radio. Excluir lo quita solo de ese recorrido.")}</p><p>{t("Marca una l\xEDnea para seleccionar todos sus recorridos guardados o marca solo la ida o vuelta que corresponda. Los recorridos que subas despu\xE9s empezar\xE1n en Autom\xE1tico.")}</p>
 {t(currentRoute && <div className="hazard-current"><strong>{t("Recorrido abierto: ")}{t(currentRoute.line)}{t(" \xB7 ")}{translatedField(currentRoute,'name')}</strong><select aria-label={t("Asignación al recorrido abierto")} value={value[currentRoute.id] || 'auto'} onChange={e => apply([currentRoute.id], e.target.value)}><option value="auto">{t("Autom\xE1tico")}</option><option value="include">{t("Incluir")}</option><option value="exclude">{t("Excluir de este recorrido")}</option></select></div>)}
 <label>{t("Buscar l\xEDnea o recorrido")}<input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("Ej.: 10, ida, Elorrieta")} /></label>
 <div className="hazard-bulk"><button type="button" onClick={() => toggle(visible.map(r => r.id), true)}>{t("Seleccionar resultados")}</button><button type="button" onClick={() => setSelected([])}>{t("Quitar selecci\xF3n")}</button><label>{t("Aplicar a ")}{t(selected.length)}{t(" recorridos")}<select value={mode} onChange={e => setMode(e.target.value)}><option value="include">{t("Incluir")}</option><option value="exclude">{t("Excluir")}</option><option value="auto">{t("Autom\xE1tico")}</option></select></label><button type="button" disabled={!selected.length} onClick={() => apply(selected, mode)}>{t("Aplicar a seleccionados")}</button></div>
 <div className="hazard-route-list">{t(lines.map(line => {
        const members = visible.filter(r => r.line === line);
        return <section key={line}><label className="hazard-check"><input type="checkbox" checked={members.every(r => selected.includes(r.id))} onChange={e => toggle(members.map(r => r.id), e.target.checked)} />{t("L\xEDnea ")}{t(line)}{t(" \xB7 ")}{t(members.length)}{t(" recorridos")}</label>{t(members.map(r => <div className="hazard-route-row" key={r.id}><label className="hazard-check"><input type="checkbox" checked={selected.includes(r.id)} onChange={e => toggle([r.id], e.target.checked)} />{t(r.direction ? `${r.direction} · ` : '')}{translatedField(r,'name')}</label><select aria-label={t("Asignaci\xF3n {0} {1}", [line, r.name])} value={value[r.id] || 'auto'} onChange={e => apply([r.id], e.target.value)}><option value="auto">{t("Autom\xE1tico")}</option><option value="include">{t("Incluir")}</option><option value="exclude">{t("Excluir")}</option></select></div>))}</section>;
      }))}{t(!visible.length && <p>{t("No hay recorridos guardados que coincidan. Crea primero el recorrido desde Biblioteca.")}</p>)}</div><p><strong>{t("Pulsa Guardar cambios para conservar estas asignaciones.")}</strong>{t(" Incluir requiere revisar la posici\xF3n del aviso antes de exportar.")}</p></fieldset>;
}
