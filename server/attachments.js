import {builtinRoutes} from './builtinRoutes.js';
const schema='CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, route_id TEXT NOT NULL, kind TEXT NOT NULL, filename TEXT NOT NULL, object_key TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL)';
export async function attachments(request,env,user,path,url){
 const match=path.match(/^\/api\/routes\/([a-zA-Z0-9-]+)\/files(?:\/([a-zA-Z0-9-]+))?$/);if(!match)return null;
 const [,routeId,id]=match;
 const bundled=builtinRoutes.find(r=>r.id===routeId);
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(!await env.DB.prepare('SELECT id FROM routes WHERE id=?').bind(routeId).first())return reply({error:'Recorrido no encontrado.'},404);
 await env.DB.prepare(schema).run();
 if(!id&&request.method==='GET'){const {results}=await env.DB.prepare('SELECT id,kind,filename,size FROM attachments WHERE route_id=? ORDER BY created_at DESC').bind(routeId).all();if(bundled)results.push({id:'bundled-pdf',kind:'pdf',filename:bundled.pdfName});return reply({files:user.role==='admin'?results:results.filter(f=>['export','pdf'].includes(f.kind)),storageReady:!!env.MEDIA,localEditor:!!env.LOCAL_EDITOR,maxUploadBytes:env.MAX_UPLOAD_BYTES||90*1024*1024});}
 if(request.method==='PUT'){
  if(user.role!=='admin')return reply({error:'Solo el administrador puede subir archivos.'},403);
  if(!env.MEDIA)return reply({error:'Activa R2 y conecta el almacén privado para guardar archivos.'},503);
  const kind=url.searchParams.get('kind'),filename=url.searchParams.get('filename')||'',type={'pdf':'application/pdf','gpx':'application/gpx+xml','video':'video/mp4','export':'video/mp4'}[kind];
  const size=Number(request.headers.get('Content-Length'));
  if(id||!type||!filename||filename.length>255||!Number.isInteger(size)||size<=0||size>(env.MAX_UPLOAD_BYTES||90*1024*1024))return reply({error:'Archivo no válido o superior al límite de subida.'},400);
  if(kind==='video'&&!env.LOCAL_EDITOR&&request.headers.get('X-EuskotrenBus-Watermarked')!=='yes')return reply({error:'El vídeo debe tener el logo EuskotrenBus grabado antes de publicarse.'},400);
  const fileId=crypto.randomUUID(),key=`routes/${routeId}/${fileId}`;
  await env.MEDIA.put(key,request.body,{httpMetadata:{contentType:type}});
  try{await env.DB.prepare('INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?)').bind(fileId,routeId,kind,filename,key,type,size,Date.now()).run();}catch(e){await env.MEDIA.delete(key);throw e;}
  return reply({id:fileId},201);
 }
 if(id==='bundled-pdf'&&bundled&&['GET','HEAD'].includes(request.method)){
  if(url.searchParams.has('download')&&user.role!=='admin')return reply({error:'Solo el administrador puede descargar documentos.'},403);
  const asset=new URL('/assets/route-pdfs/'+bundled.pdfName,url);
  const response=await env.ASSETS.fetch(new Request(asset,{method:request.method}));
  if(!response.ok)return reply({error:'Archivo no encontrado.'},404);
  const headers=new Headers(response.headers);headers.set('Content-Type','application/pdf');headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Content-Disposition',`${url.searchParams.has('download')?'attachment':'inline'}; filename="${bundled.pdfName}"`);
  return new Response(response.body,{status:response.status,headers});
 }
 if(id&&['GET','HEAD'].includes(request.method)){
  const file=await env.DB.prepare('SELECT * FROM attachments WHERE route_id=? AND id=?').bind(routeId,id).first();if(!file)return reply({error:'Archivo no encontrado.'},404);
  if((!['export','pdf'].includes(file.kind)||url.searchParams.has('download'))&&user.role!=='admin')return reply({error:'Solo el administrador puede descargar documentos.'},403);
  if(!env.MEDIA)return reply({error:'Almacén no disponible.'},503);
  const object=await env.MEDIA.get(file.object_key,{range:request.headers});if(!object)return reply({error:'Archivo no encontrado.'},404);
  const h=new Headers({'Content-Type':file.content_type,'Cache-Control':'private, no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Content-Disposition':`${url.searchParams.has('download')?'attachment':'inline'}; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g,'_')}"`});
  let status=200;if(object.range){const start=object.range.offset??Math.max(0,object.size-object.range.suffix),length=object.range.length??object.size-start;h.set('Content-Range',`bytes ${start}-${start+length-1}/${object.size}`);h.set('Content-Length',String(length));status=206;}else h.set('Content-Length',String(object.size));
  return new Response(request.method==='HEAD'?null:object.body,{status,headers:h});
 }
 return reply({error:'Operación no disponible.'},405);
}
