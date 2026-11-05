export function validateRoute(value){
 const fail=()=>{throw Object.assign(Error('El recorrido no es válido. Revisa sus paradas y nombre.'),{status:400});};
 const str=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
 const coord=c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90;
 if(!value||!str(value.id,64)||!/^[a-zA-Z0-9-]+$/.test(value.id)||!str(value.name,160)||!str(value.line,12)||!str(value.pdfName,255)||typeof value.verifiedShape!=='boolean')fail();
 if(!Array.isArray(value.stops)||value.stops.length<2||value.stops.length>200||value.stops.some(s=>!s||!str(s.code,32)||!str(s.name,180)||!coord(s.coordinates)))fail();
 if(!Array.isArray(value.shape)||value.shape.length<2||value.shape.length>10000||!value.shape.every(coord))fail();
 if(value.variant!==undefined&&(typeof value.variant!=='string'||value.variant.length>160))fail();
 return {...(typeof value.variant==='string'?{variant:value.variant}:{}),...(['Ida','Vuelta'].includes(value.direction)?{direction:value.direction}:{}),sourceType:value.sourceType==='gpx'?'gpx':'pdf',id:value.id,name:value.name.trim(),line:value.line,stops:value.stops.map(({code,name,coordinates})=>({code,name,coordinates})),shape:value.shape,verifiedShape:value.verifiedShape,pdfName:value.pdfName,sourceDate:'2026-10-29'};
}
export const routesSchema='CREATE TABLE IF NOT EXISTS routes (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL)';
