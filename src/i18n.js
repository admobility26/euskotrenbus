import eu from './locales/eu.json' with {type:'json'};
const key='euskotrenbus-language';
let language='es';try{if(globalThis.localStorage?.getItem(key)==='eu')language='eu';}catch{}
const subscribers=new Set();
export const getLanguage=()=>language;
export const locale=()=>language==='eu'?'eu-ES':'es-ES';
export const subscribeLanguage=fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);};
export function setLanguage(value){if(!['es','eu'].includes(value))return;language=value;try{globalThis.localStorage?.setItem(key,value);}catch{}if(typeof document!=='undefined'){document.documentElement.lang=value;document.title=value==='eu'?'Euskotren Bus · Ibilbideen ikasgela':'Euskotren Bus · Aula de rutas';}subscribers.forEach(fn=>fn());}
if(typeof window!=='undefined')window.addEventListener('storage',e=>{if(e.key===key&&e.newValue!==language)setLanguage(e.newValue==='eu'?'eu':'es');});
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=Object.entries(eu).filter(([es])=>/\{\d+\}/.test(es)).map(([es,value])=>{const indices=[];let offset=0,source='';for(const match of es.matchAll(/\{(\d+)\}/g)){source+=escape(es.slice(offset,match.index))+'(.+?)';indices.push(Number(match[1]));offset=match.index+match[0].length;}source+=escape(es.slice(offset));return {regex:new RegExp('^'+source+'$'),value,indices,weight:es.replace(/\{\d+\}/g,'').length};}).sort((a,b)=>b.weight-a.weight);
export function t(value,params,lang=language){
 if(typeof value!=='string')return value;
 const original=value,core=value.trim(),leading=value.match(/^\s*/)[0],trailing=value.match(/\s*$/)[0];
 const format=(text,values)=>text.replace(/\{(\d+)\}/g,(_,i)=>String(t(values[Number(i)]??'',undefined,lang)));
 if(params)return leading+format(lang==='eu'?(eu[core]??core):core,params)+trailing;
 if(lang!=='eu'||!core)return original;
 if(Object.hasOwn(eu,core))return leading+eu[core]+trailing;
 for(const {regex,value:translation,indices} of patterns){const match=core.match(regex);if(match){const values=[];indices.forEach((n,i)=>values[n]=match[i+1]);return leading+format(translation,values)+trailing;}}
 if(core.includes(' · '))return leading+core.split(' · ').map(part=>t(part,undefined,lang)).join(' · ')+trailing;
 return original;
}
export const translatedField=(item,field,lang=language)=>lang==='eu'?(item?.[field+'Eu']?.trim()||t(item?.[field]||'',undefined,lang)):(item?.[field]||'');
export const headerAsset=()=>getLanguage()==='eu'?'cabecera-euskotren-eu.svg':'cabecera-euskotren.svg';
export {eu as basqueMessages};
