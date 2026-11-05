import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateRoute} from '../server/routes.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/euskotrenbus-data.json',import.meta.url)));
test('catalogue contains the eleven coded lines and two uncoded services exactly once',()=>{
 assert.deepEqual(catalog.lines.filter(l=>l.codeProvided).map(l=>l.number),['A2315','A2316','A2326','A2336','A3411','A3414','A3422','A3451','A3471','A3472','A3499']);
 assert.equal(catalog.lines.length,13);assert.equal(new Set(catalog.lines.map(l=>l.number)).size,13);
 assert.equal(catalog.lines.find(l=>l.number==='A3414').internalNumber,'8');assert.equal(catalog.lines.find(l=>l.number==='A2315').variants.length,5);
 assert.equal(catalog.lines.find(l=>l.number==='ZAMUDIO').codeProvided,false);
 assert.ok(catalog.directions.every(r=>r.shape.length===0&&r.stops.length===0&&!r.demo));
});
test('GPX direction and selected line variant survive route validation',()=>{
 const route={id:'test',line:'A3451',name:'Armintza',direction:'Vuelta',variant:'Vuelta por Andraka',sourceType:'gpx',pdfName:'PDF opcional',verifiedShape:true,shape:[[-2.9,43.2],[-2.91,43.21]],stops:[{code:'inicio',name:'Inicio',coordinates:[-2.9,43.2]},{code:'fin',name:'Fin',coordinates:[-2.91,43.21]}]};
 assert.equal(validateRoute(route).variant,route.variant);assert.equal(validateRoute(route).direction,'Vuelta');assert.throws(()=>validateRoute({...route,variant:'x'.repeat(161)}));
});
test('deployment and local server are independent of the source company',()=>{
 const config=JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url)));assert.equal(config.name,'euskotrenbus');assert.equal(config.d1_databases,undefined);
 const worker=fs.readFileSync(new URL('../server/worker.js',import.meta.url),'utf8');assert.ok(worker.includes('__Host-euskotrenbus'));assert.ok(!worker.includes('bilbobus'));
 const server=fs.readFileSync(new URL('../server/local.mjs',import.meta.url),'utf8');assert.ok(server.includes('EUSKOTRENBUS_DATA'));assert.ok(server.includes('euskotrenbus.sqlite'));assert.ok(server.includes('5193'));
});
test('corporate assets exist and supplied logo is the export watermark',()=>{
 for(const file of ['cabecera-euskotren.svg','bus-euskotren.jpeg','euskotren-logo.png','euskotren-autobusa.jpg'])assert.ok(fs.statSync(new URL('../public/assets/'+file,import.meta.url)).size>0);
 const exporter=fs.readFileSync(new URL('../src/euskotrenbusExport.js',import.meta.url),'utf8');assert.ok(exporter.includes('euskotren-autobusa.jpg'));assert.ok(exporter.includes('drawHazard'));
});
