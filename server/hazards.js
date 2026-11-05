export function validateHazard(b) {
 const fail=()=>{throw Object.assign(Error('Revisa título, coordenadas, radios y sentidos del aviso.'),{status:400});};
 if(typeof b.title!=='string'||!b.title.trim()||b.title.length>90||typeof b.description!=='string'||b.description.length>350)fail();
 if(!Array.isArray(b.coordinates)||b.coordinates.length!==2||!b.coordinates.every(Number.isFinite)||Math.abs(b.coordinates[0])>180||Math.abs(b.coordinates[1])>90)fail();
 if(!Number.isFinite(b.radius)||b.radius<5||b.radius>60||!Number.isFinite(b.tolerance)||b.tolerance<5||b.tolerance>80)fail();
 for(const key of ['bearing','exitBearing'])if(b[key]!==null&&(!Number.isFinite(b[key])||b[key]<0||b[key]>=360))fail();
 if(typeof b.active!=='boolean')fail();
 for(const [field,max] of [['titleEu',90],['descriptionEu',350]])if(b[field]!==undefined&&(typeof b[field]!=='string'||b[field].length>max))fail();
 const assignments=b.assignments??{};
 if(!assignments||typeof assignments!=='object'||Array.isArray(assignments)||Object.keys(assignments).length>1000)fail();
 for(const [id,mode] of Object.entries(assignments))if(!/^[a-zA-Z0-9-]{1,64}$/.test(id)||!['include','exclude'].includes(mode))fail();
 return {titleEu:(b.titleEu||'').trim(),descriptionEu:(b.descriptionEu||'').trim(),assignments,title:b.title.trim(),description:b.description.trim(),coordinates:b.coordinates,radius:b.radius,tolerance:b.tolerance,bearing:b.bearing,exitBearing:b.exitBearing,active:b.active};
}
export async function hazards(request,env,user,path) {
 if(!/^\/api\/admin\/hazards(?:\/[a-zA-Z0-9-]+)?$/.test(path))return null;
 const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(user.role!=='admin')return json({error:'Solo el administrador puede consultar o editar los puntos conflictivos.'},403);
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS hazards (id TEXT PRIMARY KEY, payload TEXT NOT NULL)').run();
 const id=path.split('/')[4];
 if(request.method==='GET'&&!id){const {results}=await env.DB.prepare('SELECT payload FROM hazards ORDER BY id').all();return json({hazards:results.map(x=>JSON.parse(x.payload))});}
 if(request.method==='DELETE'&&id){await env.DB.prepare('DELETE FROM hazards WHERE id=?').bind(id).run();return json({ok:true});}
 if(request.method==='POST'&&!id||request.method==='PATCH'&&id){const raw=await request.text();if(raw.length>100000)return json({error:'Aviso demasiado largo.'},413);let b;try{b=JSON.parse(raw);}catch{return json({error:'Datos no válidos.'},400);}const item={...validateHazard(b),id:id||crypto.randomUUID()};await env.DB.prepare('INSERT INTO hazards(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(item.id,JSON.stringify(item)).run();return json({hazard:item});}
 return json({error:'Operación no disponible.'},405);
}
