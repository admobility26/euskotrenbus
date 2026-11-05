import { useLanguage } from "./Language.jsx";
import { t, locale, getLanguage, headerAsset, translatedField } from "./i18n.js";
import React, { useState } from 'react';
import { api } from './EuskotrenBusAccess.jsx';
export default function GpxRouteImport({
  line,
  empty = false,
  variants = [],
  demo,
  onSaved,
  onClose
}) {
  useLanguage();
  const [nameEu,setNameEu]=useState('');
 const [variant, setVariant] = useState(variants[0] || '');
  const [file, setFile] = useState(null),
    [name, setName] = useState(''),
    [direction, setDirection] = useState('Ida'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return <section><h2>{t(empty ? "Crear ficha sin GPX" : "Recorrido desde GPX")}</h2><p>{t("El GPX define el recorrido. A\xF1ade despu\xE9s el v\xEDdeo original para sincronizarlo. El PDF se adjunta \xFAnicamente como consulta.")}</p><div className="pdf-fields"><label>{t("Nombre en castellano")}<input value={name} onChange={e => setName(e.target.value)} maxLength={160} /></label><label>{t("Nombre en euskera (opcional)")}<input value={nameEu} onChange={e=>setNameEu(e.target.value)} maxLength={160}/></label><label>{t("Sentido")}<select value={direction} onChange={e => setDirection(e.target.value)}><option value="Ida">{t("Ida")}</option><option value="Vuelta">{t("Vuelta")}</option></select></label><label>{t("Variante")}<select value={variant} onChange={e => setVariant(e.target.value)}><option value="">{t("Sin variante")}</option>{t(variants.map(v => <option key={v} value={v}>{t(v)}</option>))}</select></label>{!empty && <label>{t("Track GPX")}<input type="file" accept=".gpx" onChange={e => setFile(e.target.files?.[0] || null)} /></label>}</div>{t(error && <p role="alert">{t(error)}</p>)}<button onClick={onClose}>{t("Volver")}</button><button disabled={(!empty && !file) || busy || demo} onClick={async () => {
      setBusy(true);
      setError('');
      try {
        if (empty) {
          const route = {id:crypto.randomUUID(),line,direction,variant,nameEu:nameEu.trim(),name:name.trim() || `Línea ${line} · ${direction}${variant ? " · " + variant : ""}`,pdfName:'PDF opcional de consulta',sourceType:'draft',verifiedShape:false,shape:[],stops:[]};
          const saved = await api('routes',{method:'POST',body:JSON.stringify(route)});
          onSaved(saved.route);
          return;
        }
        if (file.size > 20 * 1024 * 1024) throw Error('El GPX debe ocupar menos de 20 MB.');
        const doc = new DOMParser().parseFromString(await file.text(), 'application/xml');
        const nodes = [...doc.getElementsByTagName('trkpt')];
        const coords = nodes.map(p => [p.hasAttribute('lon') ? Number(p.getAttribute('lon')) : NaN, p.hasAttribute('lat') ? Number(p.getAttribute('lat')) : NaN]);
        if (doc.querySelector('parsererror') || coords.length < 2 || coords.some(c => !c.every(Number.isFinite) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90)) throw Error('El GPX no contiene un recorrido válido.');
        const stride = Math.max(1, Math.ceil(coords.length / 9999)),
          shape = coords.filter((_, i) => i % stride === 0);
        if (shape.at(-1) !== coords.at(-1)) shape.push(coords.at(-1));
        const route = {
          id: crypto.randomUUID(),
          line,
          direction,
          variant,
          nameEu:nameEu.trim(),
          name: name.trim() || `Línea ${line} · ${direction}${variant ? " · " + variant : ""}`,
          pdfName: 'PDF opcional de consulta',
          sourceType: 'gpx',
          verifiedShape: true,
          shape: shape.map(c => c.map(v => Number(v.toFixed(7)))),
          stops: [{
            code: 'inicio',
            name: 'Inicio del recorrido',
            coordinates: coords[0]
          }, {
            code: 'fin',
            name: 'Fin del recorrido',
            coordinates: coords.at(-1)
          }]
        };
        await api('routes', {
          method: 'POST',
          body: JSON.stringify(route)
        });
        const upload = await fetch(`/api/routes/${route.id}/files?kind=gpx&filename=${encodeURIComponent(file.name)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: file
        });
        if (!upload.ok) {
          onSaved({
            ...route,
            uploadWarning: 'El recorrido se guardó, pero no el GPX con sus tiempos. Añádelo desde Gestionar archivos.'
          });
          return;
        }
        onSaved(route);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }}>{t(busy ? 'Guardando…' : empty ? 'Crear ficha y añadir archivos' : 'Guardar GPX y abrir recorrido')}</button>{t(demo && <p>{t("Para guardar, abre el editor local con cuentas en el puerto 5193.")}</p>)}</section>;
}
