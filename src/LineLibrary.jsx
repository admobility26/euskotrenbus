import { useLanguage } from "./Language.jsx";
import { t, locale, getLanguage, headerAsset, translatedField } from "./i18n.js";
import LineDetails from './LineDetails.jsx';
import React, { useState, useEffect } from 'react';
import data from './euskotrenbus-data.json';
import { api } from './EuskotrenBusAccess.jsx';
import GpxRouteImport from './GpxRouteImport.jsx';
export default function LineLibrary({
  admin,
  demo,
  routes,
  onSaved,
  onOpen,
  onDemo,
  onClose
}) {
  useLanguage();
  const [limit, setLimit] = useState(90 * 1024 * 1024);
  const [line, setLine] = useState(null),
    [query, setQuery] = useState(''),
    [importing, setImporting] = useState(false),
    [chosen, setChosen] = useState(null),
    [files, setFiles] = useState([]),
    [storage, setStorage] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [marked, setMarked] = useState(false);
  const refresh = async id => {
    if (demo) {
      setFiles([]);
      setStorage(false);
      return;
    }
    try {
      const r = await api(`routes/${id}/files`);
      setFiles(r.files);
      setStorage(r.storageReady);
      setLimit(r.maxUploadBytes || 90 * 1024 * 1024);
      setMarked(r.localEditor === true);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    setFiles([]);
    setError('');
    if (chosen) void refresh(chosen.id);
  }, [chosen]);
  const upload = async (e, kind) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      if (file.size > limit) throw Error('El archivo supera el límite de subida.');
      if (kind === 'gpx') {
        const xml = new DOMParser().parseFromString(await file.text(), 'application/xml');
        if (xml.querySelector('parsererror') || xml.getElementsByTagName('trkpt').length < 2) throw Error('El GPX debe contener al menos dos puntos de track.');
      }
      const r = await fetch(`/api/routes/${chosen.id}/files?kind=${kind}&filename=${encodeURIComponent(file.name)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-EuskotrenBus-Watermarked': marked ? 'yes' : 'no'
        },
        body: file
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      await refresh(chosen.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return <div className="modal-backdrop"><section className={`catalog ${!line ? 'library-wallpaper' : ''}`} role="dialog" aria-modal="true" aria-label={t("Biblioteca de líneas")}><div className="catalog-heading"><div><small>{t("EUSKOTREN BUS \xB7 BIBLIOTECA")}</small><h2>{t(line ? `Línea ${line.number} · ${line.name}` : 'Selecciona una línea')}</h2></div><button onClick={onClose} aria-label={t("Cerrar biblioteca")}>{t("\u2715")}</button></div>{t(importing ? <GpxRouteImport empty={importing === 'empty'} line={line.number} variants={line.variants} demo={demo} onClose={() => setImporting(false)} onSaved={r => {
        onSaved(r);
        if (r.uploadWarning) setError(r.uploadWarning);
        setImporting(false);
        setChosen(r);
        if (r.sourceType !== 'draft') onOpen(r);
      }} /> : <>{t(line ? <><button onClick={() => {
            setLine(null);
            setChosen(null);
          }}>{t("\u2190 Todas las l\xEDneas")}</button>{t(admin && <button className="file-button" onClick={() => setImporting(true)}>{t("\uFF0B Crear recorrido desde GPX")}</button>)}<button className="file-button" hidden={!admin} onClick={() => setImporting('empty')}>{t("＋ Crear ficha sin GPX / añadir PDF")}</button><p>{t("Cada sentido tiene su recorrido y sus archivos. El GPX define el itinerario. El PDF es solo de consulta.")}</p><LineDetails line={line} /><div className="saved-routes">{t(routes.filter(r => r.line === line.number).map(r => <button key={r.id} onClick={() => {
              setChosen(r);
              if (r.sourceType !== 'draft') onOpen(r);
            }}><strong>{translatedField(r,'name')}</strong><small>{t(r.stops.length)}{t(" paradas \xB7 ")}{t(r.direction || 'Sentido según nombre')}{t(r.variant ? ` · ${r.variant}` : '')}</small></button>))}</div><div className="saved-routes">{t(admin && routes.filter(r => r.line === line.number).map(r => <button key={r.id} onClick={() => setChosen(r)}>{t("Gestionar PDF, v\xEDdeo y GPX \xB7 ")}{translatedField(r,'name')}{t(" \xB7 ")}{t(r.stops.length)}{t(" paradas")}</button>))}</div>{t(!routes.some(r => r.line === line.number) && <p>{t("Todav\xEDa no hay recorridos guardados para esta l\xEDnea.")}</p>)}{t(chosen && <section><h3>{translatedField(chosen,'name')}</h3><button disabled={!chosen.shape.length && !files.some(f=>f.kind==='gpx')} onClick={() => onOpen(chosen)}>{t("Abrir mapa y paradas")}</button><p>{t("Archivos del recorrido")}</p>{t(files.length === 0 && <p>{t("Ficha guardada. Añade el PDF de consulta y, cuando los tengas, el GPX y los vídeos.")}</p>)}{t(files.map(f => <div className="pdf-stop" key={f.id}><span>{t(f.kind.toUpperCase())}{t(" \xB7 ")}{t(f.filename)}</span>{f.kind === 'pdf' && <a href={`/api/routes/${chosen.id}/files/${f.id}`} target="_blank" rel="noreferrer">{t("Ver PDF")}</a>}{t(f.kind === 'export' && <a href={`/api/routes/${chosen.id}/files/${f.id}`} target="_blank" rel="noreferrer">{t("Ver MP4 final")}</a>)}{t(f.kind !== 'pdf' && f.kind !== 'export' && <button onClick={() => onOpen(chosen, files, f.id)}>{t("Usar en el mapa")}</button>)}{t(admin && <a href={`/api/routes/${chosen.id}/files/${f.id}?download`} download>{t("Descargar")}</a>)}</div>))}{t(admin && <><p>{t(storage ? 'Los archivos se guardan en el almacén privado y estarán disponibles al volver a entrar.' : 'Almacenamiento pendiente: hay que activar R2 para guardar PDF, vídeo y GPX. Los recorridos y paradas sí se guardan.')}</p>{t(limit <= 90 * 1024 * 1024 && <label className="pdf-confirm"><input type="checkbox" checked={marked} onChange={e => setMarked(e.target.checked)} />{t("El MP4 que voy a incorporar ya tiene el logo EuskotrenBus grabado en la imagen.")}</label>)}<div className="pdf-fields">{t([['export', 'MP4 final exportado · visible para usuarios', '.mp4'], ['pdf', 'PDF de consulta', '.pdf'], ['gpx', 'Track GPX', '.gpx'], ['video', 'Vídeo original (solo edición local)', '.mp4']].map(([kind, label, accept]) => <label key={kind}>{t(label)}<input type="file" accept={accept} disabled={!storage || busy || kind === 'video' && !marked} onChange={e => upload(e, kind)} /></label>))}</div><small>{t("M\xE1ximo ")}{t(Math.round(limit / 1024 / 1024))}{t(" MB por archivo. En el editor local, el logo se a\xF1ade al exportar el MP4 final.")}</small></>)}</section>)}</> : <><input aria-label={t("Buscar línea")} placeholder={t("Número o destino…")} value={query} onChange={e => setQuery(e.target.value)} /><div className="line-grid">{t(data.lines.filter(l => `${l.number} ${l.internalNumber || ''} ${l.name} ${t(l.name)}`.toLowerCase().includes(query.toLowerCase())).map(l => <button key={l.number} onClick={() => setLine(l)}><b>{t(l.number)}</b><span>{t(l.name)}<small>{t(l.internalNumber ? `Nº interno ${l.internalNumber} · ` : "Servicio sin código en la tabla · ")}{t(routes.filter(r => r.line === l.number).length)}{t(" recorridos")}</small></span></button>))}</div></>)}{t(busy && <p role="status">{t("Guardando archivo\u2026")}</p>)}{t(error && <p role="alert">{t(error)}</p>)}</>)}</section></div>;
}
