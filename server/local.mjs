import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import worker from './worker.js';
import {digest} from './password.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.resolve(process.env.EUSKOTRENBUS_DATA||path.join(root,'datos-locales'));
await fsp.mkdir(path.join(directory,'archivos'),{recursive:true});
const database=new DatabaseSync(path.join(directory,'euskotrenbus.sqlite'));
database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
database.exec(await fsp.readFile(path.join(root,'server/schema.sql'),'utf8'));
function statement(sql,args=[]){return {bind(...values){return statement(sql,values);},async first(){return database.prepare(sql).get(...args)||null;},async all(){return {results:database.prepare(sql).all(...args)};},async run(){return database.prepare(sql).run(...args);}};}
const DB={prepare:statement,async batch(items){database.exec('BEGIN');try{const result=[];for(const item of items)result.push(await item.run());database.exec('COMMIT');return result;}catch(e){database.exec('ROLLBACK');throw e;}}};
if(!database.prepare("SELECT id FROM users WHERE role='admin'").get()){
 if(!database.prepare("SELECT id FROM admin_setup WHERE id='owner'").get()){
  const token=crypto.randomUUID()+crypto.randomUUID();
  database.prepare("INSERT INTO admin_setup VALUES('owner',?,?)").run(await digest(token),Date.now()+7*86400000);
  const link=(process.env.EUSKOTRENBUS_ORIGIN||`http://127.0.0.1:${process.env.PORT||5193}`)+'/#activar='+token;
  await fsp.writeFile(path.join(directory,'ACTIVAR-ADMIN.html'),`<!doctype html><meta charset="utf-8"><title>Activar administrador</title><h1>Euskotren Bus</h1><p>Cuenta: admobility26@gmail.com</p><p><a href="${link}">Elegir mi contraseña y activar la cuenta</a></p><p>Enlace privado, de un solo uso, válido durante siete días. No compartir.</p>`,{mode:0o600});
 }

}
function objectPath(key){if(!/^[a-zA-Z0-9/-]+$/.test(key)||key.includes('..'))throw Error('Clave no válida');return path.join(directory,'archivos',key);}
async function readObject(file,headers=new Headers()){
 let stat;try{stat=await fsp.stat(file);}catch{return null;}
 const size=stat.size;let start=0,end=size-1,range;
 if(headers.has('Range')){const match=/^bytes=(\d*)-(\d*)$/.exec(headers.get('Range'));if(!match||(!match[1]&&!match[2]))throw Object.assign(Error('Rango no válido'),{status:416});start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));end=match[1]&&match[2]?Math.min(Number(match[2]),size-1):size-1;if(start>end||start>=size)throw Object.assign(Error('Rango no válido'),{status:416});range={offset:start,length:end-start+1};}
 return {size,range,body:Readable.toWeb(fs.createReadStream(file,{start,end}))};
}
const MEDIA={async put(key,body){const file=objectPath(key);await fsp.mkdir(path.dirname(file),{recursive:true});const temp=file+'.part';try{await pipeline(Readable.fromWeb(body),fs.createWriteStream(temp));await fsp.rename(temp,file);}catch(e){await fsp.rm(temp,{force:true});throw e;}},async get(key,options={}){return readObject(objectPath(key),options.range);},async delete(key){await fsp.rm(objectPath(key),{force:true});}};
const types={'.svg':'image/svg+xml','.jpeg':'image/jpeg','.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.pdf':'application/pdf'};
const ASSETS={async fetch(request){let name;try{name=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response(null,{status:400});}const dist=path.join(root,'dist');let file=path.resolve(dist,'.'+name);if(!file.startsWith(dist+path.sep)&&file!==dist)return new Response(null,{status:403});if(!path.extname(file))file=path.join(dist,'index.html');const object=await readObject(file,request.headers);if(!object)return new Response(null,{status:404});const h={'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':String(object.range?.length??object.size)};if(object.range)h['Content-Range']=`bytes ${object.range.offset}-${object.range.offset+object.range.length-1}/${object.size}`;return new Response(request.method==='HEAD'?null:object.body,{status:object.range?206:200,headers:h});}};
const port=Number(process.env.PORT||5193),host=process.env.EUSKOTRENBUS_HOST||'127.0.0.1';
const server=http.createServer(async(req,res)=>{try{const origin=process.env.EUSKOTRENBUS_ORIGIN||`http://${req.headers.host}`;const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);headers.set('CF-Connecting-IP',req.socket.remoteAddress||'local');const request=new Request(origin+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});const response=await worker.fetch(request,{DB,MEDIA,ASSETS,LOCAL_EDITOR:true,MAX_UPLOAD_BYTES:8*1024**3});res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end();}catch(e){if(!res.headersSent)res.writeHead(e.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.status?e.message:'No se pudo completar la operación.'}));}});
server.listen(port,host,()=>console.log(`EuskotrenBus local: http://${host}:${port}\nDatos: ${directory}\nAcceso inicial: ${path.join(directory,'ACTIVAR-ADMIN.html')}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{database.close();process.exit(0);}));
