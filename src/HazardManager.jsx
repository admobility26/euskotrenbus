import { useLanguage } from "./Language.jsx";
import { t, locale, getLanguage, headerAsset, translatedField } from "./i18n.js";
import HazardAssignments from './HazardAssignments.jsx';
import React, { useState, useRef, useEffect } from 'react';
import { api } from './EuskotrenBusAccess.jsx';
import { bearing } from './hazards.js';
const empty = {
  title: '',
  titleEu:'',
  descriptionEu:'',
  description: '',
  coordinates: [-2.947, 43.274],
  radius: 20,
  tolerance: 45,
  bearing: null,
  exitBearing: null,
  active: true,
  assignments: {}
};
export default function HazardManager({
  items,
  onChange,
  onClose,
  points,
  position,
  matched,
  onSeek,
  routes,
  currentRoute
}) {
  useLanguage();
  const [draft, setDraft] = useState({
      ...empty
    }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const editor = useRef();
  useEffect(() => {
    editor.current?.closest(".hazard-manager")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, []);
  const update = (key, value) => setDraft(d => ({
    ...d,
    [key]: value
  }));
  const save = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('admin/hazards' + (draft.id ? '/' + draft.id : ''), {
        method: draft.id ? 'PATCH' : 'POST',
        body: JSON.stringify(draft)
      });
      onChange([...items.filter(h => h.id !== r.hazard.id), r.hazard]);
      setDraft({
        ...empty
      });
      setNotice('Punto y asignaciones guardados. Vuelve a exportar los vídeos afectados.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const setRouteMode = async (h, mode) => {
    if (!currentRoute) return;
    setBusy(true);
    setError('');
    try {
      const assignments = {
        ...h.assignments
      };
      if (mode === 'auto') delete assignments[currentRoute.id];else assignments[currentRoute.id] = mode;
      const r = await api('admin/hazards/' + h.id, {
        method: 'PATCH',
        body: JSON.stringify({
          ...h,
          assignments
        })
      });
      onChange(items.map(x => x.id === h.id ? r.hazard : x));
      if (draft.id === h.id) setDraft(d => ({
        ...d,
        assignments
      }));
      setNotice('Asignación guardada para ' + currentRoute.name + '. Las demás líneas no cambian. Vuelve a exportar el vídeo afectado.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const locate = () => {
    const i = position.index;
    let a = i,
      b = Math.min(points.length - 1, i + 1);
    while (a > 0 && points[a - 1].segment === points[i].segment && i - a < 5) a--;
    while (b < points.length - 1 && points[b + 1].segment === points[i].segment && b - i < 5) b++;
    setDraft(d => ({
      ...d,
      coordinates: position.point.coordinates,
      bearing: Math.round(bearing(points[a].coordinates, position.point.coordinates)) % 360,
      exitBearing: Math.round(bearing(position.point.coordinates, points[b].coordinates)) % 360
    }));
  };
  return <section className="hazard-manager"><div className="hazard-heading"><h2>{t("Puntos conflictivos \xB7 base privada")}</h2><button onClick={onClose}>{t("Cerrar")}</button></div><p>{t("Se aplican a cualquier GPX que pase por la zona en el sentido indicado. La tarjeta aparece a menos de 85 m y queda incluida en la pr\xF3xima exportaci\xF3n. Los MP4 ya creados no cambian.")}</p><p>{t("Sit\xFAa el recorrido en el punto con la barra del mapa y pulsa \xABUsar posici\xF3n actual\xBB. Revisa la entrada y salida, especialmente en giros. Norte 0\xB0, este 90\xB0, sur 180\xB0, oeste 270\xB0. Dejar ambos vac\xEDos aplica a todos los sentidos.")}</p>
 {t(notice && <p role="status">{t(notice)}</p>)}<form ref={editor} onSubmit={save}><fieldset disabled={busy} className="hazard-edit-fields"><button type="button" disabled={!position?.point} onClick={locate}>{t("Usar posici\xF3n actual del recorrido")}</button><label>{t("Título en castellano")}<input required maxLength="90" value={draft.title} onChange={e => update('title', e.target.value)} /></label><label>{t("Mensaje en castellano")}<textarea maxLength="350" value={draft.description} onChange={e => update('description', e.target.value)} /></label><label>{t("Título en euskera")}<input maxLength="90" value={draft.titleEu||""} onChange={e=>update("titleEu",e.target.value)}/></label><label>{t("Mensaje en euskera")}<textarea maxLength="350" value={draft.descriptionEu||""} onChange={e=>update("descriptionEu",e.target.value)}/></label><p>{t("Añade ambas versiones para mostrar y exportar el aviso en el idioma elegido. Si falta una traducción, se muestra el texto original.")}</p><div className="hazard-fields">{t([['Longitud', 0], ['Latitud', 1]].map(([label, i]) => <label key={i}>{t(label)}<input required type="number" step="any" value={draft.coordinates[i]} onChange={e => update('coordinates', draft.coordinates.map((v, j) => i === j ? Number(e.target.value) : v))} /></label>))}{t([['Radio de asignación (m)', 'radius', 5, 60], ['Tolerancia de sentido (°)', 'tolerance', 5, 80], ['Entrada (°), vacío = cualquiera', 'bearing', 0, 359], ['Salida (°), vacío = cualquiera', 'exitBearing', 0, 359]].map(([label, key, min, max]) => <label key={key}>{t(label)}<input type="number" min={min} max={max} required={key === 'radius' || key === 'tolerance'} value={draft[key] ?? ''} onChange={e => update(key, e.target.value === '' ? null : Number(e.target.value))} /></label>))}</div><label><input type="checkbox" checked={draft.active} onChange={e => update('active', e.target.checked)} />{t(" Aviso activo")}</label><HazardAssignments key={draft.id || "new"} value={draft.assignments} onChange={value => update("assignments", value)} routes={routes} currentRoute={currentRoute} /><button disabled={busy}>{t(draft.id ? 'Guardar cambios' : 'Crear punto conflictivo')}</button><button type="button" onClick={() => setDraft({
          ...empty
        })}>{t("Nuevo")}</button>{t(error && <p role="alert">{t(error)}</p>)}</fieldset></form>
 <h3>{t(matched.matches.length)}{t(" coincidencias en el recorrido abierto")}</h3><p>{t("Comprueba cada coincidencia antes de exportar; calles pr\xF3ximas y errores del GPS pueden requerir reducir el radio.")}</p>{t(matched.matches.map((m, i) => <button key={i} onClick={() => onSeek(m.at)}>{translatedField(m.hazard,'title')}{t(m.manual ? ' · Manual' : '')}{t(m.separation > 60 ? ' · Alejado del GPX, revisar' : '')}{t(" \xB7 revisar paso")}</button>))}<h3>{t("Base de datos (")}{t(items.length)}{t(")")}</h3>{t(items.map(h => <article key={h.id}><strong>{translatedField(h,'title')}{t(!h.active ? ' · Inactivo' : '')}</strong><p>{translatedField(h,'description')}</p><button disabled={busy} onClick={() => {
        setDraft({
          ...h,
          assignments: {
            ...h.assignments
          }
        });
        setNotice("Editando: " + h.title);
        editor.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }}>{t("Editar punto y asignaciones")}</button>{t(currentRoute && <label>{t("En este recorrido")}<select disabled={busy} value={h.assignments?.[currentRoute.id] || "auto"} onChange={e => setRouteMode(h, e.target.value)}><option value="auto">{t("Autom\xE1tico")}</option><option value="include">{t("Incluir")}</option><option value="exclude">{t("Excluir de este recorrido")}</option></select></label>)}<button disabled={busy} onClick={async () => {
        if (!confirm(t('¿Eliminar este punto de todos los recorridos futuros?'))) return;
        setBusy(true);
        try {
          await api('admin/hazards/' + h.id, {
            method: 'DELETE'
          });
          onChange(items.filter(x => x.id !== h.id));
          if (draft.id === h.id) setDraft({
            ...empty
          });
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}>{t("Eliminar de toda la base")}</button></article>))}</section>;
}
