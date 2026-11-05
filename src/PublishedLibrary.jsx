import { useLanguage } from "./Language.jsx";
import { t, locale, getLanguage, headerAsset, translatedField } from "./i18n.js";
import LineDetails from './LineDetails.jsx';
import React, { useEffect, useState } from 'react';
import { api } from './EuskotrenBusAccess.jsx';
import data from './euskotrenbus-data.json';
import ConsultPdf from './ConsultPdf.jsx';
export default function PublishedLibrary({
  session,
  logout
}) {
  useLanguage();
  const [routes, setRoutes] = useState([]),
    [line, setLine] = useState(null),
    [selected, setSelected] = useState(null),
    [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [mediaTab, setMediaTab] = useState('video');
  const library = () => {
    setSelected(null);
    setLine(null);
    setQuery('');
  };
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const result = await api('routes');
        const ready = await Promise.all(result.routes.map(async r => {
          try {
            const f = await api(`routes/${r.id}/files`);
            return {
              ...r,
              exports: f.files.filter(x => x.kind === 'export'),
              pdfs: f.files.filter(x => x.kind === 'pdf')
            };
          } catch {
            return {
              ...r,
              exports: [],
              pdfs: [],
              unavailable: true
            };
          }
        }));
        if (live) setRoutes(ready);
      } catch (e) {
        if (live) setError(e.message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  const open = r => {
    setSelected(r);
    setMediaTab(r.exports.length ? 'video' : 'pdf');
  };
  const file = selected && (mediaTab === 'video' ? selected.exports[0] : selected.pdfs[0]);
  return <div className="app"><header className="image-header"><img src={"/assets/"+headerAsset()} alt={t("EuskotrenBus · Aula de rutas")} /><nav className="image-header-nav"><button onClick={() => {
          if (selected) document.getElementById('reader-content')?.scrollIntoView({
            behavior: 'smooth'
          });else library();
        }}>{t("Explorar recorrido")}</button><button onClick={library}>{t("Biblioteca de l\xEDneas")}</button></nav></header><div className="account-bar"><span>{t(session.user.username)}{t(" \xB7 Usuario")}</span><button onClick={logout}>{t("Cerrar sesi\xF3n")}</button></div><main className={`catalog reader-library ${!line && !selected ? 'library-wallpaper' : ''}`}><div className="catalog-heading"><h1>{t(selected ? translatedField(selected,'name') : line ? `Línea ${line.number} · ${line.name}` : 'Biblioteca de líneas')}</h1>{t((line || selected) && <button onClick={() => selected ? setSelected(null) : library()}>{t("\u2190 Volver")}</button>)}</div>{t(loading && <p>{t("Cargando biblioteca\u2026")}</p>)}{t(error && <p role="alert">{t(error)}</p>)}{t(!selected && !line && <><input aria-label={t("Buscar línea")} placeholder={t("Número o destino…")} value={query} onChange={e => setQuery(e.target.value)} /><div className="line-grid">{t(data.lines.filter(l => `${l.number} ${l.internalNumber || ''} ${l.name} ${t(l.name)}`.toLowerCase().includes(query.toLowerCase())).map(l => <button key={l.number} onClick={() => setLine(l)}><b>{t(l.number)}</b><span>{t(l.name)}<small>{t(l.internalNumber ? `Nº interno ${l.internalNumber} · ` : "Servicio sin código en la tabla · ")}{t(routes.filter(r => r.line === l.number && (r.exports.length || r.pdfs.length)).length)}{t(" recorridos con contenido")}</small></span></button>))}</div></>)}{t(line && !selected && <div className="saved-routes"><LineDetails line={line} />{t(routes.filter(r => r.line === line.number).map(r => <button key={r.id} onClick={() => open(r)}><strong>{translatedField(r,'name')}</strong><small>{t(r.exports.length ? 'Vídeo PIP disponible' : 'Vídeo pendiente')}{t(" \xB7 ")}{t(r.pdfs.length ? 'PDF disponible' : 'PDF pendiente')}</small></button>))}{t(!routes.some(r => r.line === line.number) && <p>{t("Todav\xEDa no hay recorridos publicados para esta l\xEDnea.")}</p>)}</div>)}{t(selected && <section id="reader-content"><div className="demo-controls"><button aria-pressed={mediaTab === 'video'} onClick={() => setMediaTab('video')}>{t("V\xEDdeo PIP")}</button><button aria-pressed={mediaTab === 'pdf'} onClick={() => setMediaTab('pdf')}>{t("Consultar PDF")}</button></div>{t(selected.unavailable && <p role="alert">{t("No se pudieron consultar los archivos. Recarga la biblioteca.")}</p>)}{t(file ? mediaTab === 'video' ? <video key={file.id} src={`/api/routes/${selected.id}/files/${file.id}`} controls controlsList="nodownload" playsInline style={{
          width: '100%'
        }} /> : <ConsultPdf key={file.id} url={`/api/routes/${selected.id}/files/${file.id}`} /> : <p>{t(mediaTab === 'video' ? 'Todavía no se ha publicado el MP4 final de este recorrido.' : 'Todavía no se ha adjuntado el PDF de consulta.')}</p>)}</section>)}</main></div>;
}
