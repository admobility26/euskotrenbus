import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRoute} from '../server/routes.js';
const draft={id:'draft-1',line:'A2315',name:'Línea A2315 · Ida',direction:'Ida',variant:'Por Portugalete',pdfName:'PDF opcional de consulta',sourceType:'draft',verifiedShape:false,shape:[],stops:[]};
test('Empty route dossiers preserve direction without fabricating map geometry',()=>{
 const saved=validateRoute(draft);
 assert.equal(saved.sourceType,'draft');assert.equal(saved.direction,'Ida');assert.deepEqual(saved.shape,[]);assert.deepEqual(saved.stops,[]);
 assert.throws(()=>validateRoute({...draft,verifiedShape:true}));
 assert.throws(()=>validateRoute({...draft,sourceType:'gpx'}));
 assert.throws(()=>validateRoute({...draft,shape:[[0,0],[1,1]]}));
});
