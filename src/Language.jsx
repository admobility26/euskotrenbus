import React,{useEffect,useSyncExternalStore} from 'react';
import {getLanguage,setLanguage,subscribeLanguage,t} from './i18n.js';
export function useLanguage(){return useSyncExternalStore(subscribeLanguage,getLanguage,()=> 'es');}
export default function LanguageSwitcher(){const language=useLanguage();useEffect(()=>{setLanguage(getLanguage());},[]);return <nav className="language-switcher" aria-label="Hizkuntza / Idioma"><span>{t('Idioma')}</span><button type="button" lang="eu" aria-pressed={language==='eu'} onClick={()=>setLanguage('eu')}>Euskara</button><button type="button" lang="es" aria-pressed={language==='es'} onClick={()=>setLanguage('es')}>Castellano</button></nav>;}
