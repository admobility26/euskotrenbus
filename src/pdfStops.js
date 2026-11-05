export const normalizeStop=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function detectedStops(text,pattern){
 const normalized=` ${normalizeStop(text)} `;
 return pattern.stops.map(stop=>({...stop,included:[stop.name,...(stop.aliases||[])].some(name=>{const n=normalizeStop(name);return n.length>=5&&normalized.includes(` ${n} `);})}));
}
export function importedRoute({title,line,pattern,rows,filename}){
 const stops=rows.filter(s=>s.included).map(({code,name,coordinates})=>({code,name,coordinates}));
 if(stops.length<2)throw Error('Selecciona al menos dos paradas.');
 const verifiedShape=stops.length===pattern.stops.length&&stops.every((s,i)=>s.code===pattern.stops[i].code)&&pattern.shape.length>1;
 return {id:crypto.randomUUID(),name:title.trim()||pattern.name,line,stops,shape:verifiedShape?pattern.shape:stops.map(s=>s.coordinates),verifiedShape,pdfName:filename,sourceDate:'2026-10-29'};
}
