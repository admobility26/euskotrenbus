import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchHazards,activeHazard} from '../src/hazards.js';
import {hazards,validateHazard} from '../server/hazards.js';
const h={id:'test',title:'Giro estrecho',description:'Abrir el giro con precaución.',coordinates:[0,0],radius:15,bearing:90,exitBearing:null,tolerance:35,active:true};
const points=Array.from({length:41},(_,i)=>({coordinates:[(i-20)*.0001,0],segment:0}));
test('automatically matches approach direction but excludes opposite direction',()=>{assert.equal(matchHazards(points,[h]).matches.length,1);assert.equal(matchHazards([...points].reverse(),[h]).matches.length,0);assert.equal(matchHazards(points,[{...h,bearing:null}]).matches.length,1);});
test('popup only appears near matching passage and disabled points are excluded',()=>{const m=matchHazards(points,[h]);assert.equal(activeHazard(m,points,{index:20,point:points[20]}).id,'test');assert.equal(activeHazard(m,points,{index:0,point:points[0]}),null);assert.equal(matchHazards(points,[{...h,active:false}]).matches.length,0);});
test('exit direction distinguishes a turn from going straight',()=>{assert.equal(matchHazards(points,[{...h,exitBearing:0}]).matches.length,0);const turn=[...points.slice(0,21),...Array.from({length:20},(_,i)=>({coordinates:[0,(i+1)*.0001],segment:0}))];assert.equal(matchHazards(turn,[{...h,exitBearing:0}]).matches.length,1);});
test('does not assign adjacent street outside radius or bridge segment gaps',()=>{assert.equal(matchHazards(points,[{...h,coordinates:[0,.001]}]).matches.length,0);assert.equal(matchHazards([{coordinates:[-.01,0],segment:0},{coordinates:[.01,0],segment:1}],[h]).matches.length,0);});
test('private catalogue rejects readers before accessing storage',async()=>{for(const method of ['GET','POST','PATCH','DELETE']){const r=await hazards(new Request('http://localhost/api/admin/hazards',{method}),{}, {role:'reader'},'/api/admin/hazards');assert.equal(r.status,403);}});
test('validates persisted direction, coordinates and text',()=>{assert.equal(validateHazard(h).bearing,90);for(const patch of [{bearing:360},{coordinates:[NaN,0]},{radius:500},{description:'x'.repeat(351)}])assert.throws(()=>validateHazard({...h,...patch}));});
test('admin catalogue survives reload, supports edits and deletion',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(':memory:');const env={DB:{prepare(sql){return {run:()=>db.prepare(sql).run(),all:()=>({results:db.prepare(sql).all()}),bind(...args){return {run:()=>db.prepare(sql).run(...args)};}}}}};
 const call=(method,path,body)=>hazards(new Request('http://localhost'+path,{method,...(body?{body:JSON.stringify(body)}:{})}),env,{role:'admin'},path);
 try{const created=await (await call('POST','/api/admin/hazards',h)).json();const id=created.hazard.id;assert.ok(id);assert.equal((await (await call('GET','/api/admin/hazards')).json()).hazards.length,1);await call('PATCH','/api/admin/hazards/'+id,{...h,title:'Actualizado',assignments:Object.fromEntries(Array.from({length:110},(_,i)=>['route-'+String(i).padStart(36,'0'),i%2?'include':'exclude']))});assert.equal((await (await call('GET','/api/admin/hazards')).json()).hazards[0].title,'Actualizado');assert.equal(Object.keys((await (await call('GET','/api/admin/hazards')).json()).hazards[0].assignments).length,110);await call('DELETE','/api/admin/hazards/'+id);assert.equal((await (await call('GET','/api/admin/hazards')).json()).hazards.length,0);}finally{db.close();}
});
test('route exclusion affects only that direction and auto restores matching',()=>{
 const excluded={...h,assignments:{'10-ida':'exclude'}};
 assert.equal(matchHazards(points,[excluded],'10-ida').matches.length,0);
 assert.equal(matchHazards(points,[excluded],'10-vuelta').matches.length,1);
 assert.equal(matchHazards(points,[{...excluded,assignments:{}}],'10-ida').matches.length,1);
});
test('manual assignment overrides direction and radius at nearest GPX passage',()=>{
 const distant={...h,coordinates:[0,.002],bearing:270,assignments:{'10-ida':'include','03-ida':'include','10-vuelta':'exclude'}};
 for(const id of ['10-ida','03-ida']){const m=matchHazards(points,[distant],id);assert.equal(m.matches.length,1);assert.equal(m.matches[0].manual,true);assert.ok(m.matches[0].separation>200);assert.equal(activeHazard(m,points,{index:20,point:points[20]}).id,h.id);assert.equal(activeHazard(m,points,{index:0,point:points[0]}),null);}
 for(const id of ['10-vuelta','other'])assert.equal(matchHazards(points,[distant],id).matches.length,0);
 assert.equal(matchHazards(points,[{...distant,active:false}],'10-ida').matches.length,0);
});
test('manual assignment does not bridge disconnected GPX segments',()=>{
 assert.equal(matchHazards([{coordinates:[-.01,0],segment:0},{coordinates:[.01,0],segment:1}],[{...h,assignments:{route:'include'}}],'route').matches.length,0);
});
test('validates batch assignments and accepts legacy points without assignments',()=>{
 assert.deepEqual(validateHazard(h).assignments,{});
 const assignments=Object.fromEntries(Array.from({length:110},(_,i)=>['route-'+i,i%2?'exclude':'include']));assert.deepEqual(validateHazard({...h,assignments}).assignments,assignments);
 for(const assignments of [[],{route:'bogus'},{'bad/key':'include'},Object.fromEntries(Array.from({length:1001},(_,i)=>['r'+i,'include']))])assert.throws(()=>validateHazard({...h,assignments}));
});
