import LanguageSwitcher from './Language.jsx';
import PublishedLibrary from './PublishedLibrary.jsx';
import React from 'react';
import {createRoot} from 'react-dom/client';
import EuskotrenBus from './EuskotrenBus.jsx';
import {AccessGate} from './EuskotrenBusAccess.jsx';
import 'maplibre-gl/dist/maplibre-gl.css';
import './euskotrenbus.css';
createRoot(document.getElementById('root')).render(<><LanguageSwitcher/><AccessGate>{(session,logout)=>session.user.role==='admin'?<EuskotrenBus key={session.user.id} session={session} logout={logout}/>:<PublishedLibrary key={session.user.id} session={session} logout={logout}/>}</AccessGate></>);
