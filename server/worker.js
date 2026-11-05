import {adminSetup} from './adminSetup.js';
import {hazards} from './hazards.js';
import {attachments} from './attachments.js';
import {validateRoute,routesSchema} from './routes.js';
import {digest,passwordHash,verifyPassword} from './password.js';
const DAY=86400000,COOKIE='__Host-euskotrenbus';
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const publicUser=u=>({id:u.id,username:u.username,role:u.role,expiresAt:u.expires_at,active:!!u.active});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const normalize=s=>String(s||'').trim().toLowerCase();
const checkUsername=s=>{if(!/^[a-z0-9.@_ -]{3,64}$/.test(s))fail('Usuario: entre 3 y 64 letras, números, espacios, puntos, @ o guiones.');};
const checkPassword=s=>{if(typeof s!=='string'||s.length<10||s.length>128)fail('La contraseña debe tener entre 10 y 128 caracteres.');};
const expiry=days=>{if(!Number.isInteger(days)||days<1||days>3650)fail('La duración debe ser de 1 a 3650 días.');return Date.now()+days*DAY;};
const cookieName=url=>url.protocol==='https:'?COOKIE:'euskotrenbus-local';
const setCookie=(url,token,age)=>`${cookieName(url)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${url.protocol==='https:'?'; Secure':''}`;
async function body(request,max=8192){if(Number(request.headers.get('Content-Length')||0)>max)fail('Petición demasiado grande.',413);const text=await request.text();if(text.length>max)fail('Petición demasiado grande.',413);try{return JSON.parse(text);}catch{fail('Petición no válida.');}}
async function session(request,env,url){const raw=request.headers.get('Cookie')||'';const token=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName(url)+'='))?.split('=')[1];if(!token)return null;const hash=await digest(token);const user=await env.DB.prepare('SELECT users.*, sessions.expires_at AS session_expiry FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=?').bind(hash).first();if(!user||!user.active||user.session_expiry<=Date.now()||(user.role!=='admin'&&(!user.expires_at||user.expires_at<=Date.now()))){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(hash).run();return null;}return {...user,sessionHash:hash};}
function requireAdmin(user){if(user.role!=='admin')fail('Solo el administrador puede realizar esta operación.',403);}
async function handle(request,env){
 const url=new URL(request.url);
 let path;try{path=decodeURIComponent(url.pathname);}catch{fail("Ruta no válida.",400);}
 // All media, including built-in demos, goes through an authenticated endpoint.
 if(path.startsWith('/assets/')&&/\.(mp4|gpx|pdf)$/i.test(path))return json({error:'Acceso directo a archivos deshabilitado.'},403);
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
 if(!env.DB)fail('El servicio de cuentas todavía no está configurado.',503);
 if(!['GET','HEAD'].includes(request.method)){if(request.headers.get('Origin')!==url.origin)fail('Origen de petición no autorizado.',403);if(!(request.method==='PUT'&&/^\/api\/routes\/[a-zA-Z0-9-]+\/files$/.test(path))&&!request.headers.get('Content-Type')?.startsWith('application/json'))fail('Se requiere JSON.',415);}
 const setupResponse=await adminSetup(request,env,path);if(setupResponse)return setupResponse;
 if(path==='/api/login'&&request.method==='POST'){
  const b=await body(request),username=normalize(b.username),ip=request.headers.get('CF-Connecting-IP')||'local';
  const limitKey=await digest(ip),now=Date.now();
  await env.DB.prepare('INSERT INTO login_limits(key,attempts,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN resets_at<=? THEN 1 ELSE attempts+1 END, resets_at=CASE WHEN resets_at<=? THEN ? ELSE resets_at END').bind(limitKey,now+15*60000,now,now,now+15*60000).run();
  const limit=await env.DB.prepare('SELECT attempts FROM login_limits WHERE key=?').bind(limitKey).first();if(limit.attempts>10)fail('Demasiados intentos. Espera 15 minutos.',429);
  const user=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
  // Execute a password derivation even when the username does not exist.
  const valid=user?await verifyPassword(String(b.password||''),user.password_hash):(await passwordHash(String(b.password||'')),false);
  if(!valid||!user.active||(user.role!=='admin'&&(!user.expires_at||user.expires_at<=now)))fail('Usuario, contraseña o periodo de acceso no válidos.',401);
  await env.DB.prepare('DELETE FROM login_limits WHERE key=?').bind(limitKey).run();
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join(''),end=Math.min(now+DAY,user.role==='admin'?now+DAY:user.expires_at);
  await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),user.id,end).run();return json({user:publicUser(user),mode:'authenticated'},200,{'Set-Cookie':setCookie(url,token,Math.floor((end-now)/1000))});
 }
 const user=await session(request,env,url);if(!user)fail('Inicia sesión con una cuenta vigente.',401);
 const hazardResponse=await hazards(request,env,user,path);if(hazardResponse)return hazardResponse;
 const fileResponse=await attachments(request,env,user,path,url);if(fileResponse)return fileResponse;
 if(path==='/api/session'&&request.method==='GET')return json({user:publicUser(user),mode:'authenticated'});
 if(path==='/api/logout'&&request.method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.sessionHash).run();return json({ok:true},200,{'Set-Cookie':setCookie(url,'',0)});}
 if(path==='/api/password'&&request.method==='POST'){
  const b=await body(request);checkPassword(b.password);
  if(!await verifyPassword(String(b.currentPassword||''),user.password_hash))fail('La contraseña actual no es correcta.',403);
  await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await passwordHash(b.password),user.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
  return json({ok:true},200,{'Set-Cookie':setCookie(url,'',0)});
 }
 if(path==='/api/admin/users'){
  requireAdmin(user);
  if(request.method==='GET'){const {results}=await env.DB.prepare('SELECT id,username,role,expires_at,active,created_at FROM users ORDER BY created_at DESC').all();return json({users:results.map(publicUser)});}
  if(request.method==='POST'){const b=await body(request),username=normalize(b.username);checkUsername(username);checkPassword(b.password);const end=expiry(Number(b.days));if(await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(username).first())fail('Ese usuario ya existe.',409);await env.DB.prepare("INSERT INTO users(id,username,password_hash,role,expires_at,active,created_at) VALUES(?,?,?,'reader',?,1,?)").bind(crypto.randomUUID(),username,await passwordHash(b.password),end,Date.now()).run();return json({ok:true},201);}
 }
 const userMatch=path.match(/^\/api\/admin\/users\/([a-zA-Z0-9-]+)$/);
 if(userMatch&&request.method==='PATCH'){
  requireAdmin(user);const id=userMatch[1],target=await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();if(!target)fail('Usuario no encontrado.',404);if(target.role==='admin')fail('Este panel solo modifica cuentas de usuarios.',403);
  const b=await body(request);if(!['days','active','password'].some(k=>k in b))fail('No hay cambios que aplicar.');
  const end=b.days===undefined?target.expires_at:expiry(Number(b.days));if(b.active!==undefined&&typeof b.active!=='boolean')fail('Estado no válido.');if(b.password!==undefined)checkPassword(b.password);
  await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=?, expires_at=?, active=? WHERE id=?').bind(b.password===undefined?target.password_hash:await passwordHash(b.password),end,b.active===undefined?target.active:Number(b.active),id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id)]);return json({ok:true});
 }
 const syncPath=path.match(/^\/api\/routes\/([a-zA-Z0-9-]+)\/sync$/);
 if(syncPath&&request.method==='POST'){requireAdmin(user);const b=await body(request);if(!Number.isFinite(b.offset)||Math.abs(b.offset)>7200||typeof b.videoName!=='string'||typeof b.trackName!=='string'||b.videoName.length>255||b.trackName.length>255)fail('Sincronización no válida.');const saved=await env.DB.prepare('SELECT payload FROM routes WHERE id=?').bind(syncPath[1]).first();if(!saved)fail('Recorrido no encontrado.',404);const route=JSON.parse(saved.payload);route.sync={offset:b.offset,videoName:b.videoName,trackName:b.trackName};await env.DB.prepare('UPDATE routes SET payload=? WHERE id=?').bind(JSON.stringify(route),route.id).run();return json({ok:true});}
 if(path==='/api/routes'){
  if(request.method==='POST')requireAdmin(user);
  // Additive migration keeps existing user databases compatible with this release.
  await env.DB.prepare(routesSchema).run();
  if(request.method==='GET'){const {results}=await env.DB.prepare('SELECT payload FROM routes ORDER BY created_at DESC LIMIT 500').all();return json({routes:results.map(r=>JSON.parse(r.payload))});}
  if(request.method==='POST'){const route=validateRoute(await body(request,400000));await env.DB.prepare('INSERT INTO routes(id,payload,created_by,created_at) VALUES(?,?,?,?)').bind(route.id,JSON.stringify(route),user.id,Date.now()).run();return json({route},201);}
 }
 if(path==='/api/media'&&request.method==='GET'){const {results}=await env.DB.prepare("SELECT id,filename,kind,line,direction,watermarked FROM media WHERE published=1 AND (kind!='video' OR watermarked=1)").all();return json({media:results});}
 const media=path.match(/^\/api\/media\/([a-zA-Z0-9-]+)$/);
 if(media&&['GET','HEAD'].includes(request.method)){
  const item=await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(media[1]).first();if(!item||!item.published)fail('Archivo no disponible.',404);
  if(url.searchParams.has('download')||item.kind==='export')requireAdmin(user);
  if(item.kind==='video'&&!item.watermarked)fail('El vídeo no está preparado con marca de agua.',403);
  if(!env.MEDIA)fail('El almacén privado no está configurado.',503);
  const object=await env.MEDIA.get(item.object_key,{range:request.headers});if(!object)fail('Archivo no encontrado.',404);
  const headers=new Headers({'Content-Type':item.content_type,'Cache-Control':'private, no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Content-Disposition':`${url.searchParams.has('download')?'attachment':'inline'}; filename="${item.filename.replace(/[^a-zA-Z0-9._-]/g,'_')}"`});
  let status=200;if(object.range){const start=object.range.offset??Math.max(0,object.size-object.range.suffix),length=object.range.length??object.size-start;headers.set('Content-Range',`bytes ${start}-${start+length-1}/${object.size}`);headers.set('Content-Length',String(length));status=206;}else headers.set('Content-Length',String(object.size));
  return new Response(request.method==='HEAD'?null:object.body,{status,headers});
 }
 return json({error:'Operación no disponible.'},404);
}
export default {async fetch(request,env){try{return await handle(request,env);}catch(e){if(!e.status)console.error('Request failed',e.name);return json({error:e.status?e.message:'No se pudo completar la operación.'},e.status||500);}}};
