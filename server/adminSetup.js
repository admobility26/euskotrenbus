import {digest,passwordHash} from './password.js';
export const ADMIN_USERNAME='admobility26@gmail.com';
export const setupSchema='CREATE TABLE IF NOT EXISTS admin_setup (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, expires_at INTEGER NOT NULL)';
export async function adminSetup(request,env,path){
 if(path!=='/api/setup')return null;
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 const existing=await env.DB.prepare("SELECT id FROM users WHERE role='admin'").first();
 if(request.method==='GET')return json({required:!existing,username:ADMIN_USERNAME});
 if(request.method!=='POST')return json({error:'Operación no disponible.'},405);
 if(existing)return json({error:'El administrador ya está activado. Inicia sesión.'},409);
 const supplied=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
 await env.DB.prepare(setupSchema).run();
 const grant=await env.DB.prepare("SELECT token_hash,expires_at FROM admin_setup WHERE id='owner'").first();
 if(!supplied||supplied.length>256||!grant||grant.expires_at<=Date.now()||await digest(supplied)!==grant.token_hash)return json({error:'Abre el enlace privado de activación del administrador. El enlace puede haber caducado.'},403);
 const raw=await request.text();if(raw.length>2048)return json({error:'Petición demasiado grande.'},413);
 let b;try{b=JSON.parse(raw);}catch{return json({error:'Petición no válida.'},400);}
 if(b.username!==ADMIN_USERNAME)return json({error:'La cuenta administradora es '+ADMIN_USERNAME+'.'},400);
 if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)return json({error:'Elige una contraseña de entre 10 y 128 caracteres.'},400);
 if(b.password!==b.repeat)return json({error:'Las contraseñas no coinciden.'},400);
 const hash=await passwordHash(b.password);
 // Stable primary key and conditional insertion prevent concurrent claims/resetting an owner.
 await env.DB.prepare("INSERT INTO users(id,username,password_hash,role,expires_at,active,created_at) SELECT 'administrator',?,?,'admin',NULL,1,? WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='admin') ON CONFLICT DO NOTHING").bind(ADMIN_USERNAME,hash,Date.now()).run();
 const saved=await env.DB.prepare("SELECT password_hash FROM users WHERE id='administrator'").first();
 if(saved?.password_hash!==hash)return json({error:'El administrador ya está activado. Inicia sesión.'},409);
 await env.DB.prepare("DELETE FROM admin_setup WHERE id='owner'").run();
 return json({ok:true},201);
}
