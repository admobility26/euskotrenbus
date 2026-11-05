import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getLanguage,setLanguage,t,translatedField,locale,basqueMessages} from '../src/i18n.js';
import {validateHazard} from '../server/hazards.js';
import {validateRoute} from '../server/routes.js';
import {drawHazard} from '../src/hazards.js';
test('language selection preserves interpolation, legal names and user text',()=>{
 setLanguage('eu');assert.equal(getLanguage(),'eu');assert.equal(locale(),'eu-ES');
 assert.equal(t('Biblioteca de líneas'),'Lineen liburutegia');assert.equal(t('Página {0} de {1}',[2,9]),'2. orria, guztira 9');assert.equal(t('Página 2 de 9'),'2. orria, guztira 9');
 assert.equal(t('Línea A3451 · Ida · Normal'),'A3451 linea · Joan · Ohikoa');
 assert.equal(t('Mi nombre personal de ruta'),'Mi nombre personal de ruta');assert.equal(t('archivo.gpx'),'archivo.gpx');
 assert.equal(t('Usuario, contraseña o periodo de acceso no válidos.'),'Erabiltzaile-izena, pasahitza edo sarbide-epea ez dira baliozkoak.');
 setLanguage('es');assert.equal(t('Página {0} de {1}',[2,9]),'Página 2 de 9');assert.equal(t('Ida'),'Ida');
});
test('every catalogue label and variant has a Basque translation',()=>{
 const {lines}=JSON.parse(fs.readFileSync(new URL('../src/euskotrenbus-data.json',import.meta.url)));
 for(const l of lines)for(const text of [l.name,l.outbound,l.inbound,...l.variants].filter(Boolean))assert.ok(Object.hasOwn(basqueMessages,text),'Missing: '+text);
 for(const [es,eu] of Object.entries(basqueMessages))assert.deepEqual([...es.matchAll(/\{\d+\}/g)].map(x=>x[0]).sort(),[...eu.matchAll(/\{\d+\}/g)].map(x=>x[0]).sort(),es);
});
test('bilingual hazard fields persist, validate and drive the exported warning language',()=>{
 const h=validateHazard({title:'Giro estrecho',titleEu:'Biraketa estua',description:'Precaución',descriptionEu:'Kontuz',coordinates:[-2.9,43.2],radius:20,tolerance:45,bearing:null,exitBearing:null,active:true});
 assert.equal(translatedField(h,'title','eu'),'Biraketa estua');assert.equal(translatedField(h,'title','es'),'Giro estrecho');assert.throws(()=>validateHazard({...h,titleEu:'x'.repeat(91)}));
 const texts=[],ctx={save(){},restore(){},beginPath(){},roundRect(){},fill(){},stroke(){},fillText(s){texts.push(s);},measureText(s){return {width:s.length*6};}};
 setLanguage('es');drawHazard(ctx,h,'eu');assert.ok(texts.includes('⚠ PUNTU GATAZKATSUA'));assert.ok(texts.includes('Biraketa estua'));assert.ok(texts.includes('Kontuz'));assert.ok(!texts.includes('Giro estrecho'));
});
test('route translations persist without translating canonical direction values',()=>{
 const r=validateRoute({id:'test',line:'A3451',name:'Prueba',nameEu:'Proba',direction:'Ida',variant:'Normal',sourceType:'gpx',pdfName:'PDF opcional',verifiedShape:true,shape:[[-2.9,43.2],[-2.91,43.21]],stops:[{code:'inicio',name:'Inicio',coordinates:[-2.9,43.2]},{code:'fin',name:'Fin',coordinates:[-2.91,43.21]}]});assert.equal(r.nameEu,'Proba');assert.equal(r.direction,'Ida');assert.equal(r.variant,'Normal');assert.equal(translatedField(r,'name','eu'),'Proba');
});
