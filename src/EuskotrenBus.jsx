import { useLanguage } from "./Language.jsx";
import { t, locale, getLanguage, headerAsset, translatedField } from "./i18n.js";
import HazardManager from './HazardManager.jsx';
import { matchHazards, activeHazard } from './hazards.js';
import { syncOffset, routeFraction, videoSecond } from './videoSync.js';
import LineLibrary from './LineLibrary.jsx';
import { api } from './EuskotrenBusAccess.jsx';
import { UserManager, PasswordChange } from './EuskotrenBusAccess.jsx';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Map, Marker, LngLatBounds, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { pointAt, timeline } from './reviewTime.js';
import data from './euskotrenbus-data.json';
setWorkerUrl(workerUrl);
const asset = n => `${import.meta.env.BASE_URL}assets/${n}`;
const lineFeature = coordinates => ({
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates
  }
});
export default function EuskotrenBus({
  session,
  logout
}) {
  const language=useLanguage();
  const isAdmin = session.user.role === 'admin',
    localDemo = session.mode === 'demo';
  const [usersOpen, setUsersOpen] = useState(false),
    [passwordOpen, setPasswordOpen] = useState(false);
  const [pdfImport, setPdfImport] = useState(false),
    [savedRoutes, setSavedRoutes] = useState([]),
    [customRoute, setCustomRoute] = useState(null);
  useEffect(() => {
    if (!localDemo) api('routes').then(r => {
      setSavedRoutes(r.routes);
      const last = localStorage.getItem('euskotrenbus-route-' + session.user.id);
      const saved = r.routes.find(x => x.id === last);
      if (saved) void openSaved(saved);
    }).catch(e => setError(e.message));
  }, [localDemo]);
  const [direction, setDirection] = useState(0),
    [selected, setSelected] = useState(0),
    [catalog, setCatalog] = useState(true),
    [query, setQuery] = useState(''),
    [video, setVideo] = useState(''),
    [videoName, setVideoName] = useState(''),
    [track, setTrack] = useState(null),
    [trackName, setTrackName] = useState(''),
    [fraction, setFraction] = useState(0),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [offset, setOffset] = useState(0),
    [mapError, setMapError] = useState(false),
    [pipOpen, setPipOpen] = useState(true),
    [playbackRate, setPlaybackRate] = useState(1),
    [exportStatus, setExportStatus] = useState(null),
    [exportFile, setExportFile] = useState(null);
  const [calibrating, setCalibrating] = useState(false),
    [syncNotice, setSyncNotice] = useState('');
  const [hazardItems, setHazardItems] = useState([]),
    [hazardsOpen, setHazardsOpen] = useState(false),
    [hazardsReady, setHazardsReady] = useState(false);
  useEffect(() => {
    if (isAdmin && !localDemo) api('admin/hazards').then(r => {
      setHazardItems(r.hazards);
      setHazardsReady(true);
    }).catch(e => setError('No se pudieron cargar los avisos: ' + e.message));
  }, [isAdmin, localDemo]);
  const exportAbort = useRef();
  const container = useRef(),
    map = useRef(),
    markers = useRef([]),
    cursor = useRef(),
    videoRef = useRef();
  const route = customRoute || data.directions[direction],
    stop = route.stops[selected] || {
      name: "Carga un GPX desde la biblioteca",
      code: "—"
    },
    demoMode = !!route.demo && !customRoute && !video && !track,
    videoSrc = video || (demoMode ? localDemo ? asset(route.demo.video) : `/api/demo/${direction}` : ''),
    points = track || (demoMode ? route.demo.points : route.shape.map(coordinates => ({
      coordinates,
      segment: 0
    })));
  const hazardPoints = useMemo(() => track || route.shape.map(coordinates => ({
    coordinates,
    segment: 0
  })), [track, route]);
  const matched = useMemo(() => matchHazards(hazardPoints, hazardItems, customRoute?.id), [hazardPoints, hazardItems, customRoute?.id]);
  const hazardPosition = pointAt(hazardPoints, fraction),
    visibleHazard = activeHazard(matched, hazardPoints, hazardPosition);
  const syncVideo = v => {
    if (calibrating || !v?.duration) return;
    const clock = timeline(points);
    setFraction(Math.max(0, Math.min(1, track && clock.timed ? routeFraction(v.currentTime, offset, clock.duration) : v.currentTime / v.duration)));
    if (demoMode) setSelected(Math.min(route.stops.length - 1, Math.floor((v.currentTime + .015) / 4)));
  };
  const current = useRef({
    points,
    route,
    track
  });
  current.current = {
    points,
    route,
    track
  };
  const fit = () => {
    const coords = current.current.track?.map(p => p.coordinates) || current.current.route.shape;
    if (!coords.length) return;
    const bounds = new LngLatBounds();
    coords.forEach(c => bounds.extend(c));
    map.current?.fitBounds(bounds, {
      padding: {
        top: 70,
        bottom: 80,
        left: 65,
        right: 65
      },
      duration: 600
    });
  };
  useEffect(() => {
    const m = new Map({
      container: container.current,
      center: [-2.947, 43.274],
      zoom: 13.3,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{
          id: 'base',
          type: 'raster',
          source: 'osm'
        }]
      }
    });
    map.current = m;

    m.on('error', () => setMapError(true));
    m.on('load', () => {
      m.addSource('route', {
        type: 'geojson',
        data: lineFeature(current.current.route.verifiedShape === false ? [] : current.current.route.shape)
      });
      m.addLayer({
        id: 'outline',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#fff',
          'line-width': 9
        }
      });
      m.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#0769aa',
          'line-width': 5
        }
      });
      m.addSource('progress', {
        type: 'geojson',
        data: lineFeature([])
      });
      m.addLayer({
        id: 'progress',
        type: 'line',
        source: 'progress',
        paint: {
          'line-color': '#087d87',
          'line-width': 5
        }
      });
      setReady(true);
    });
    return () => m.remove();
  }, []);
  useEffect(() => {
    if (!ready) return;
    map.current.getSource('route').setData(lineFeature(track ? track.map(p => p.coordinates) : route.verifiedShape === false ? [] : route.shape));
    markers.current.forEach(m => m.remove());
    markers.current = route.stops.map((s, i) => {
      const el = document.createElement('button');
      el.className = 'stop-marker';
      el.textContent = i + 1;
      el.title = s.name;
      el.setAttribute('aria-label', t('Parada {0}: {1}',[i+1,s.name]));
      el.onclick = () => chooseStop(i);
      return new Marker({
        element: el
      }).setLngLat(s.coordinates).addTo(map.current);
    });
    fit();
    return () => markers.current.forEach(m => m.remove());
  }, [ready, direction, track, demoMode, customRoute]);
  useEffect(() => {
    markers.current.forEach((m, i) => m.getElement().classList.toggle('chosen', i === selected));
  }, [selected, direction, ready, track, customRoute]);
  useEffect(() => {
    if (!ready) return;
    if (route.verifiedShape === false && !track) {
      cursor.current?.remove();
      cursor.current = null;
      map.current.getSource('progress')?.setData(lineFeature([]));
      return;
    }
    const p = pointAt(points, fraction).point;
    if (!p) return;
    if (!cursor.current) {
      const el = document.createElement('div');
      el.className = 'bus-marker';
      el.textContent = '➤';
      cursor.current = new Marker({
        element: el
      }).setLngLat(p.coordinates).addTo(map.current);
    }
    cursor.current.setLngLat(p.coordinates);
    const at = pointAt(points, fraction);
    const traveled = points.slice(0, at.index + 1).map(p => p.coordinates);
    traveled.push(at.point.coordinates);
    if (traveled.length < 2) traveled.push(at.point.coordinates);
    map.current.getSource('progress')?.setData(lineFeature(traveled));
  }, [fraction, ready, direction, track, customRoute]);
  useEffect(() => {
    if (!playing || videoSrc) return;
    const id = setInterval(() => setFraction(f => {
      if (f >= 1) {
        setPlaying(false);
        return 1;
      }
      return Math.min(1, f + 0.0025);
    }), 100);
    return () => clearInterval(id);
  }, [playing, videoSrc]);
  useEffect(() => () => {
    if (video) URL.revokeObjectURL(video);
  }, [video]);
  useEffect(() => {
    if (!playing || !videoSrc) return;
    let frame;
    const tick = () => {
      syncVideo(videoRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, videoSrc, demoMode, direction, track, offset, calibrating]);
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, videoSrc]);
  useEffect(()=>{markers.current.forEach((marker,i)=>{const s=route.stops[i];if(s){marker.getElement().title=t(s.name);marker.getElement().setAttribute('aria-label',t('Parada {0}: {1}',[i+1,s.name]));}});},[language,route]);
  const chooseStop = i => {
    setSelected(i);
    if (demoMode && videoRef.current) {
      videoRef.current.currentTime = route.demo.stopTimes[i];
      setFraction(route.demo.stopTimes[i] / route.demo.duration);
    }
    map.current?.easeTo({
      center: current.current.route.stops[i].coordinates,
      zoom: 15,
      duration: 650
    });
  };
  const changeDirection = d => {
    setCalibrating(false);
    setSyncNotice('');
    localStorage.removeItem('euskotrenbus-route-' + session.user.id);
    setCustomRoute(null);
    setDirection(d);
    setSelected(0);
    setFraction(0);
    setPlaying(false);
    setTrack(null);
    setTrackName('');
    setVideo('');
    setVideoName('');
    setOffset(0);
    setError('');
  };
  const openSaved = async (r, knownFiles, preferred) => {
    changeDirection(0);
    localStorage.setItem('euskotrenbus-route-' + session.user.id, r.id);
    setCustomRoute(r);
    setCatalog(false);
    setPdfImport(false);
    if (localDemo) return;
    try {
      const files = knownFiles || (await api(`routes/${r.id}/files`)).files;
      const pick = kind => files.find(f => f.id === preferred && f.kind === kind) || files.find(f => f.kind === kind);
      const movie = pick('video'),
        gpx = pick('gpx');
      if (movie) {
        setVideo(`/api/routes/${r.id}/files/${movie.id}`);
        setVideoName(movie.filename);
      }
      if (r.sync && r.sync.videoName === movie?.filename && r.sync.trackName === gpx?.filename) setOffset(r.sync.offset);
      if (gpx) {
        const response = await fetch(`/api/routes/${r.id}/files/${gpx.id}`);
        if (!response.ok) throw Error('No se pudo cargar el GPX guardado.');
        const doc = new DOMParser().parseFromString(await response.text(), 'application/xml');
        const pts = [...doc.getElementsByTagName('trkpt')].map(p => ({
          coordinates: [Number(p.getAttribute('lon')), Number(p.getAttribute('lat'))],
          time: Date.parse(p.getElementsByTagName('time')[0]?.textContent),
          segment: [...doc.getElementsByTagName('trkseg')].indexOf(p.parentNode)
        }));
        if (doc.querySelector('parsererror') || pts.length < 2 || pts.some(p => !p.coordinates.every(Number.isFinite) || Math.abs(p.coordinates[0]) > 180 || Math.abs(p.coordinates[1]) > 90)) throw Error('El GPX guardado no contiene un track válido.');
        setTrack(pts);
        setTrackName(gpx.filename);
      }
    } catch (e) {
      setError(e.message);
    }
  };
  const loadTrack = async e => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const doc = new DOMParser().parseFromString(await file.text(), 'application/xml');
      if (doc.querySelector('parsererror')) throw Error('El archivo GPX no es válido.');
      const pts = [...doc.getElementsByTagName('trkpt')].map(p => ({
        coordinates: [Number(p.getAttribute('lon')), Number(p.getAttribute('lat'))],
        time: Date.parse(p.getElementsByTagName('time')[0]?.textContent),
        segment: 0
      }));
      if (pts.length < 2 || pts.some(p => !p.coordinates.every(Number.isFinite) || Math.abs(p.coordinates[0]) > 180 || Math.abs(p.coordinates[1]) > 90)) throw Error('El GPX debe contener al menos dos puntos válidos.');
      setTrack(pts);
      setTrackName(file.name);
      setFraction(0);
      setPlaying(false);
      videoRef.current?.pause();
      setError('');
    } catch (err) {
      setError(err.message);
    }
    e.target.value = '';
  };
  const loadVideo = e => {
    if (!isAdmin) return;
    const f = e.target.files?.[0];
    if (!f) return;
    setVideo(URL.createObjectURL(f));
    setVideoName(f.name);
    setPlaying(false);
    setFraction(0);
    setError('');
    e.target.value = '';
  };
  const togglePlay = () => {
    setPipOpen(true);
    if (videoSrc) {
      if (videoRef.current.paused) videoRef.current.play().catch(() => setError('Este formato de vídeo no se puede reproducir en el navegador. Prueba con MP4.'));else videoRef.current.pause();
    } else {
      if (fraction >= 1) setFraction(0);
      setPlaying(!playing);
    }
  };
  const seek = f => {
    setFraction(f);
    if (!calibrating && videoRef.current && Number.isFinite(videoRef.current.duration)) {
      const clock = timeline(points);
      videoRef.current.currentTime = track && clock.timed ? Math.max(0, Math.min(videoRef.current.duration, videoSecond(f, clock.duration, offset))) : f * videoRef.current.duration;
    }
  };
  const exportMovie = async () => {
    if (!isAdmin) {
      setError('Solo el administrador puede exportar.');
      return;
    }
    if (!hazardsReady && !localDemo) {
      setError('Espera a que se carguen los puntos conflictivos antes de exportar.');
      return;
    }
    if (exportAbort.current) return;
    videoRef.current?.pause();
    setPlaying(false);
    setError('');
    const controller = new AbortController();
    exportAbort.current = controller;
    setExportStatus({
      percent: 0,
      label: 'Preparando exportación…'
    });
    try {
      const fileHandle = window.showSaveFilePicker ? await window.showSaveFilePicker({
        suggestedName: `EuskotrenBus-${customRoute?.line || '—'}-${direction}-PIP.mp4`,
        types: [{
          description: t('Vídeo MP4'),
          accept: {
            'video/mp4': ['.mp4']
          }
        }]
      }) : null;
      const {
        exportEuskotrenBusMp4
      } = await import('./euskotrenbusExport.js');
      const blob = await exportEuskotrenBusMp4({
        language:getLanguage(),
        hazards: hazardItems,
        videoUrl: videoSrc,
        route,
        points,
        demoMode,
        offset,
        headerUrl: asset(headerAsset()),
        signal: controller.signal,
        onProgress: setExportStatus,
        fileHandle
      });
      if (!blob) {
        setSyncNotice('MP4 guardado en el archivo elegido.');
        return;
      }
      setExportFile({
        url: URL.createObjectURL(blob),
        name: `EuskotrenBus-linea${customRoute?.line || '—'}-${customRoute?.direction || 'recorrido'}${demoMode ? '-simulacion' : ''}.mp4`
      });
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || 'No se pudo exportar el MP4.');
    } finally {
      exportAbort.current = null;
      setExportStatus(null);
    }
  };
  useEffect(() => () => {
    if (exportFile) URL.revokeObjectURL(exportFile.url);
  }, [exportFile]);
  useEffect(() => () => exportAbort.current?.abort(), []);
  return <div className="app"><header className="image-header"><img src={asset(headerAsset())} alt={t("EuskotrenBus · Aula de rutas. Cada línea, un recorrido que conocer. Recorridos, vídeo y puntos de atención en Bizkaia.")} /><nav className="image-header-nav"><button onClick={() => {
          setCatalog(false);
          container.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }}>{t("Explorar recorrido")}</button><button onClick={() => setCatalog(true)}>{t("Biblioteca de l\xEDneas")}</button></nav></header>
 <div className="account-bar"><span>{t(localDemo ? 'Muestra local · administrador' : `${session.user.username} · ${isAdmin ? 'Administrador' : 'Usuario'}`)}{t(!isAdmin && session.user.expiresAt && ` · Acceso hasta ${new Date(session.user.expiresAt).toLocaleDateString(locale())}`)}</span><div>{t(isAdmin && <><button onClick={() => setUsersOpen(true)}>{t("Usuarios y acceso")}</button><button onClick={() => setHazardsOpen(v => !v)}>{t("Puntos conflictivos")}</button></>)}{t(!localDemo && <><button onClick={() => setPasswordOpen(true)}>{t("Mi contrase\xF1a")}</button><button onClick={logout}>{t("Cerrar sesi\xF3n")}</button></>)}</div></div><div className="workspace"><aside className="sidebar"><div className="route-title"><span className="line-badge">{t(customRoute?.line || '—')}</span><div><small>{t(customRoute ? route.sourceType === 'gpx' ? 'RECORRIDO GPX' : 'RECORRIDO GUARDADO' : 'BIBLIOTECA DE RECORRIDOS')}</small><h2>{t(customRoute ? translatedField(route,'name') : <>{t("Euskotren Bus")}<br /><span>{t("Selecciona una l\xEDnea")}</span></>)}</h2></div><button title={t("Ver líneas")} onClick={() => setCatalog(true)}>{t("\u2304")}</button></div>{t(!customRoute && data.directions.length > 1 && <div className="direction"><label htmlFor="direction">{t("Sentido del recorrido")}</label><select id="direction" value={direction} onChange={e => changeDirection(Number(e.target.value))}>{t(data.directions.map((d, i) => <option key={i} value={i}>{t(d.name)}</option>))}</select></div>)}<div className="stop-heading"><strong>{t("Puntos del recorrido")}</strong><span>{t(route.stops.length)}</span></div><div className="stops">{t(route.stops.map((s, i) => <button className={`stop ${i === selected ? 'active' : ''}`} key={s.code} onClick={() => chooseStop(i)}><span className="stop-number">{t(String(i + 1).padStart(2, '0'))}</span><span>{t(s.name)}<small>{t(i === 0 ? 'Origen' : i === route.stops.length - 1 ? 'Destino' : `Parada · ${s.code}`)}</small></span>{t(i === selected && <b>{t("\u2197")}</b>)}</button>))}</div></aside>
 <main className="map-area"><div className="map-toolbar"><div><strong>{t("Explorador de la l\xEDnea ")}{t(customRoute?.line || '—')}</strong>{t(customRoute && <small>{t("PDF: ")}{t(route.pdfName)}{t(" \xB7 ")}{t(video ? 'Vídeo disponible' : 'Sin vídeo')}{t(" \xB7 ")}{t(track ? 'GPX disponible' : 'Sin GPX')}{t(" \xB7 Recorrido guardado")}</small>)}<span>{t(customRoute ? route.verifiedShape ? route.sourceType === 'gpx' ? 'Itinerario del GPX' : 'Paradas revisadas · trazado oficial' : 'Paradas revisadas · sin trazado confirmado' : track ? 'Track local cargado' : 'Abre una línea de la biblioteca y añade su GPX')}</span></div><button onClick={fit}>{t("\u2922 Ver recorrido completo")}</button></div><div className="map-stage"><div className="map" ref={container} /><div className="map-zoom-controls"><button aria-label={t("Acercar")} title={t("Acercar")} onClick={()=>map.current?.zoomIn()}>＋</button><button aria-label={t("Alejar")} title={t("Alejar")} onClick={()=>map.current?.zoomOut()}>−</button></div><div className="map-label"><i /> {translatedField(route,'name')} <span>{t("\xB7 ")}{t(route.stops.length)}{t(" paradas")}</span></div>{t(mapError && <div className="map-warning">{t("No se ha podido cargar parte del mapa base. Comprueba la conexi\xF3n a Internet.")}</div>)}{t((customRoute || videoSrc) && <div className={`pip ${pipOpen ? '' : 'pip-collapsed'}`}><div className="pip-title"><span>{t("\u25A3 V\xCDDEO DEL RECORRIDO")}</span><button onClick={() => setPipOpen(!pipOpen)} aria-label={t(pipOpen ? 'Minimizar vídeo' : 'Mostrar vídeo')}>{t(pipOpen ? '−' : '＋')}</button></div><div className="watermarked-pip" style={{
              display: pipOpen ? 'block' : 'none'
            }}>{t(videoSrc ? <video key={videoSrc} ref={videoRef} src={videoSrc} controls controlsList="nodownload" disablePictureInPicture={!isAdmin} playsInline preload="auto" muted={demoMode} onLoadedMetadata={e => {
                e.currentTarget.playbackRate = playbackRate;
              }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError('No se puede reproducir este vídeo. Prueba con un archivo MP4 compatible.')} onTimeUpdate={e => syncVideo(e.currentTarget)} /> : <div className="video-empty"><span className="play-symbol">{t("\u25B7")}</span><strong>{t("La pr\xF3xima vista ser\xE1 desde el bus.")}</strong><p>{t("A\xF1ade un v\xEDdeo para revisar el recorrido")}<br />{t("junto al mapa y sus paradas.")}</p>{t(isAdmin && <label className="upload-video">{t("\uFF0B Cargar v\xEDdeo")}<input type="file" accept="video/*" onChange={loadVideo} /></label>)}</div>)}<img className="video-watermark" src={asset('logo-euskotren-bus.svg')} alt={t("Marca de agua EuskotrenBus")} /><div className="pip-footer">{t(videoName || (demoMode ? 'SIMULACIÓN · vista ilustrada, no real' : 'Sin vídeo · carga una grabación local'))}{t(videoSrc && isAdmin && demoMode && <button onClick={() => videoRef.current.requestPictureInPicture ? videoRef.current.requestPictureInPicture().catch(() => setError('No se puede abrir el PIP externo en este navegador. El panel flotante sigue disponible.')) : setError('Este navegador no ofrece PIP externo. Puedes usar el panel flotante sobre el mapa.')}>{t("\u2197 PIP")}</button>)}</div></div></div>)}{t(visibleHazard && <aside className="hazard-popup" role="status"><small>{t("\u26A0 PUNTO CONFLICTIVO")}</small><strong>{translatedField(visibleHazard,'title')}</strong><p>{translatedField(visibleHazard,'description')}</p></aside>)}{t(customRoute && <div className="selected-card"><span className="selected-num">{t(String(selected + 1).padStart(2, '0'))}</span><div><small>{t(route.sourceType === 'gpx' ? 'PUNTO DEL RECORRIDO' : 'PARADA · PUNTO DE ATENCIÓN')}</small><strong>{t(stop.name)}</strong><span>{t("C\xF3digo ")}{t(stop.code)}{t(" \xB7 ")}{t(route.sourceType === 'gpx' ? 'Ubicación del GPX' : 'Ubicación del recorrido')}</span></div><div className="stop-arrows"><button disabled={selected === 0} onClick={() => chooseStop(selected - 1)} aria-label={t("Parada anterior")}>{t("\u2190")}</button><button disabled={selected === route.stops.length - 1} onClick={() => chooseStop(selected + 1)} aria-label={t("Parada siguiente")}>{t("\u2192")}</button></div></div>)}</div>
 <div className="timeline"><button className="play-button" disabled={route.verifiedShape === false && !track && !videoSrc} onClick={togglePlay} aria-label={t(playing ? 'Pausar' : 'Reproducir demostración')}>{t(playing ? 'Ⅱ' : '▶')}</button><div><div className="timeline-label"><strong>{t(demoMode ? 'Demostración sincronizada · mapa + vídeo' : video ? 'Reproducción de vídeo' : 'Vista previa del recorrido')}</strong><span>{t(demoMode ? `${Math.floor(fraction * route.demo.duration)} / ${route.demo.duration} s` : `${Math.round(fraction * 100)} %`)}</span></div><input disabled={route.verifiedShape === false && !track && !videoSrc} aria-label={t("Posición en el recorrido")} type="range" min="0" max="1" step="0.001" value={fraction} onChange={e => seek(Number(e.target.value))} /><small>{t(demoMode ? 'Escena ilustrada y tiempos simulados. Las paradas y el trazado proceden de datos oficiales.' : track ? timeline(points).timed ? 'GPX con tiempos · ajusta el desfase del vídeo para sincronizar' : 'GPX sin tiempos · avance proporcional de demostración' : video ? 'Vídeo y mapa vinculados de forma proporcional: sincronización real pendiente del GPX.' : customRoute?.verifiedShape === false ? 'Solo paradas: el PDF no acredita un trazado completo.' : 'Simulación visual sobre el trazado oficial; no representa tiempos ni velocidad reales.')}</small></div></div><div className="demo-controls">{t(isAdmin && <button className="export-button" disabled={!!exportStatus || !videoSrc || route.verifiedShape === false && !track} onClick={exportMovie}>{t("\u2193 Exportar MP4")}</button>)}<button onClick={() => {
            seek(0);
            setSelected(0);
            fit();
          }}>{t("\u21BA Reiniciar recorrido")}</button><label>{t("Velocidad")}<select aria-label={t("Velocidad de reproducción")} value={playbackRate} onChange={e => setPlaybackRate(Number(e.target.value))}><option value="0.5">{t("0,5\xD7")}</option><option value="1">{t("1\xD7")}</option><option value="2">{t("2\xD7")}</option></select></label><span><i />{t(" Tramo recorrido")}</span><button onClick={() => setCatalog(true)}>{t("Abrir biblioteca")}</button></div></main></div>
 {t(isAdmin && track && video && <section className="export-status"><strong>{t("Sincronizaci\xF3n mapa + PIP")}</strong><p>{t("Pausa, sit\xFAa el recorrido y el v\xEDdeo en el mismo instante y vinc\xFAlalos. Requiere horas v\xE1lidas en el GPX.")}</p><button disabled={!timeline(points).timed} onClick={() => {
        videoRef.current?.pause();
        setPlaying(false);
        setCalibrating(v => !v);
      }}> {t(calibrating ? 'Salir del ajuste' : 'Ajustar sincronización')}</button>{t(calibrating && <><label>{t("Segundo del v\xEDdeo")}<input type="number" min="0" step="0.1" defaultValue={videoRef.current?.currentTime || 0} onChange={e => {
            if (videoRef.current) videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, Number(e.target.value)));
          }} /></label><p>{t("Mueve la barra del recorrido: durante el ajuste no mueve el v\xEDdeo.")}</p><button onClick={async () => {
          const value = syncOffset(fraction * timeline(points).duration, videoRef.current.currentTime);
          setOffset(value);
          setCalibrating(false);
          try {
            if (customRoute && !localDemo) await api('routes/' + customRoute.id + '/sync', {
              method: 'POST',
              body: JSON.stringify({
                offset: value,
                videoName,
                trackName
              })
            });
            if (customRoute) {
              setCustomRoute(r => ({
                ...r,
                sync: {
                  offset: value,
                  videoName,
                  trackName
                }
              }));
              setSavedRoutes(rs => rs.map(r => r.id === customRoute.id ? {
                ...r,
                sync: {
                  offset: value,
                  videoName,
                  trackName
                }
              } : r));
            }
            setSyncNotice(customRoute && !localDemo ? 'Sincronización guardada para este recorrido.' : 'Sincronización aplicada a esta sesión.');
          } catch (e) {
            setError(e.message);
          }
        }}>{t("Vincular este instante")}</button></>)}<span>{t("Desfase: ")}{t(offset.toFixed(2))}{t(" s")}</span></section>)}{t(syncNotice && <p role="status" className="export-status">{t(syncNotice)}</p>)}
 <section className="export-status" aria-live="polite">{t(exportStatus && <><strong>{t(exportStatus.label)} {t(exportStatus.percent)}{t("%")}</strong><progress max="100" value={exportStatus.percent} /><button onClick={() => exportAbort.current?.abort()}>{t("Cancelar exportaci\xF3n")}</button></>)}{t(isAdmin && exportFile && <><span>{t("MP4 listo \xB7 mapa, paradas y v\xEDdeo PIP")}</span><a className="download-mp4" href={exportFile.url} download={exportFile.name}>{t("\u2193 Descargar MP4")}</a></>)}</section><section className="bottom"><div className="source"><strong>{t("Euskotren Bus \xB7 Formaci\xF3n sobre el recorrido")}</strong><p>{t("Cat\xE1logo transcrito de la tabla facilitada. Los itinerarios se incorporan mediante GPX; el PDF es de consulta.")}</p><small>{t("Basado en Rutas AD \xB7 AD Mobility. Biblioteca y usuarios independientes.")}</small></div>{t(isAdmin && customRoute && <div className="imports"><label className="file-button">{t("\uFF0B ")}{t(trackName || 'Cargar track GPX')}<input type="file" accept=".gpx" onChange={loadTrack} /></label><label className="file-button">{t("\uFF0B ")}{t(video ? 'Cambiar vídeo' : 'Cargar vídeo')}<input type="file" accept="video/*" onChange={loadVideo} /></label>{t(track && video && <label className="offset">{t("Desfase v\xEDdeo (s)")}<input type="number" value={offset} onChange={e => setOffset(Number(e.target.value))} /></label>)}<small>{t("Los archivos se usan solo en esta sesi\xF3n, sin subirlos.")}</small></div>)}</section>{t(error && <div role="alert" className="error">{t(error)}<button onClick={() => setError('')}>{t("Cerrar")}</button></div>)}
 {t(hazardsOpen && isAdmin && <HazardManager routes={savedRoutes} currentRoute={customRoute} items={hazardItems} onChange={setHazardItems} onClose={() => setHazardsOpen(false)} points={hazardPoints} position={hazardPosition} matched={matched} onSeek={meters => {
      const i = matched.cumulative.findIndex(d => d >= meters),
        index = i < 0 ? hazardPoints.length - 1 : i,
        clock = timeline(hazardPoints);
      seek(clock.timed ? (hazardPoints[index].time - clock.start) / (clock.end - clock.start) : index / Math.max(1, hazardPoints.length - 1));
      container.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }} />)}{t(passwordOpen && <PasswordChange onClose={() => setPasswordOpen(false)} onChanged={() => location.reload()} />)}{t(usersOpen && <UserManager demo={localDemo} onClose={() => setUsersOpen(false)} />)}
 {t(catalog && <LineLibrary admin={isAdmin} demo={localDemo} routes={savedRoutes} onSaved={r => setSavedRoutes(v => [r, ...v])} onOpen={openSaved} onDemo={() => {
      changeDirection(0);
      setCatalog(false);
    }} onClose={() => setCatalog(false)} />)}

 </div>;
}
