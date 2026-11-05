import { useLanguage } from "./Language.jsx";
import { t, locale, getLanguage, headerAsset, translatedField } from "./i18n.js";
import React, { useEffect, useRef, useState } from 'react';
export default function ConsultPdf({
  url
}) {
  useLanguage();
  const canvas = useRef(),
    [doc, setDoc] = useState(null),
    [page, setPage] = useState(1),
    [error, setError] = useState('');
  useEffect(() => {
    let stopped = false,
      task;
    setDoc(null);
    setPage(1);
    setError('');
    (async () => {
      try {
        const pdf = await import('pdfjs-dist');
        if (stopped) return;
        pdf.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
        task = pdf.getDocument({
          url,
          isEvalSupported: false
        });
        const d = await task.promise;
        if (!stopped) setDoc(d);
      } catch (e) {
        if (!stopped) setError('No se pudo abrir el PDF.');
      }
    })();
    return () => {
      stopped = true;
      void task?.destroy();
    };
  }, [url]);
  useEffect(() => {
    if (!doc) return;
    let stopped = false,
      render;
    (async () => {
      try {
        const p = await doc.getPage(page);
        if (stopped) return;
        const viewport = p.getViewport({
          scale: 1.4
        });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        render = p.render({
          canvasContext: canvas.current.getContext('2d'),
          viewport
        });
        await render.promise;
      } catch (e) {
        if (!stopped && e.name !== 'RenderingCancelledException') setError('No se pudo mostrar esta página.');
      }
    })();
    return () => {
      stopped = true;
      render?.cancel();
    };
  }, [doc, page]);
  return <section aria-label={t("Consulta del PDF")}><div className="demo-controls"><button disabled={!doc || page <= 1} onClick={() => setPage(p => p - 1)}>{t("P\xE1gina anterior")}</button><span>{t(doc ? `Página ${page} de ${doc.numPages}` : 'Cargando PDF…')}</span><button disabled={!doc || page >= doc.numPages} onClick={() => setPage(p => p + 1)}>{t("P\xE1gina siguiente")}</button></div>{t(error && <p role="alert">{t(error)}</p>)}<canvas ref={canvas} aria-label={t("P\xE1gina {0} del PDF", [page])} style={{
      maxWidth: '100%',
      height: 'auto',
      display: doc ? 'block' : 'none',
      margin: 'auto'
    }} /></section>;
}
