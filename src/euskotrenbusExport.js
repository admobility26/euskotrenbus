import {matchHazards,activeHazard,drawHazard} from './hazards.js';
import {routeFraction,exportLimit} from './videoSync.js';
import {Map,LngLatBounds} from 'maplibre-gl';
import {Input,UrlSource,ALL_FORMATS,CanvasSink,AudioSampleSink,AudioSampleSource,Output,Mp4OutputFormat,BufferTarget,StreamTarget,CanvasSource,Quality,canEncodeVideo,canEncodeAudio} from 'mediabunny';
import {pointAt,timeline} from './reviewTime.js';
const abort=signal=>{if(signal?.aborted)throw new DOMException('Exportación cancelada.','AbortError');};
const line=coordinates=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates}});
const image=url=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('No se pudo cargar la carátula.'));img.src=url;});
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
export async function exportEuskotrenBusMp4({hazards=[],videoUrl,route,points,demoMode,offset=0,headerUrl,signal,onProgress,fileHandle}){
 if(!videoUrl)throw Error('Carga un vídeo o vuelve a la simulación para exportar el recorrido.');
 if(!await canEncodeVideo('avc',{width:1280,height:720,frameRate:20}))throw Error('Este navegador no permite crear MP4 H.264. Abre la muestra en Chrome o Edge actualizado.');
 abort(signal);
 let input,output,exportMap,host,videoIterator,audioIterator,audioNext,disk,done=false;
 try{
  input=new Input({source:new UrlSource(videoUrl),formats:ALL_FORMATS});
  const videoTrack=await input.getPrimaryVideoTrack();
  if(!videoTrack||!await videoTrack.canDecode())throw Error('No se puede decodificar este vídeo para exportar. Prueba un MP4 H.264.');
  const duration=await videoTrack.computeDuration();
  exportLimit(duration,!!fileHandle);
  const audioTrack=await input.getPrimaryAudioTrack();
  if(audioTrack&&(!await audioTrack.canDecode()||!await canEncodeAudio('aac',{sampleRate:48000,numberOfChannels:2})))throw Error('No se puede conservar el audio de este archivo en este navegador. Prueba Chrome o Edge.');
  onProgress({percent:0,label:'Preparando mapa y vídeo…'});
  const header=await image(headerUrl),watermark=await image(new URL('logo-euskotren-bus.svg',new URL(headerUrl,location.href)).href);abort(signal);
  host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-10000px',top:'0',width:'850px',height:'456px',pointerEvents:'none'});document.body.append(host);
  const shape=points.map(p=>p.coordinates);
  exportMap=new Map({container:host,interactive:false,attributionControl:false,canvasContextAttributes:{preserveDrawingBuffer:true},style:{version:8,sources:{base:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256},route:{type:'geojson',data:line(shape)}},layers:[{id:'base',type:'raster',source:'base'},{id:'halo',type:'line',source:'route',paint:{'line-color':'#fff','line-width':8}},{id:'route',type:'line',source:'route',paint:{'line-color':'#0769aa','line-width':4}}]}});
  const bounds=new LngLatBounds();shape.forEach(c=>bounds.extend(c));exportMap.fitBounds(bounds,{padding:35,duration:0});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(Error('El mapa no terminó de cargar. Comprueba la conexión y vuelve a exportar.')),25000);const stop=()=>finish(new DOMException('Exportación cancelada.','AbortError'));const finish=err=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);exportMap.off('idle',loaded);err?reject(err):resolve();};const loaded=()=>finish();signal?.addEventListener('abort',stop,{once:true});exportMap.once('idle',loaded);});abort(signal);
  const background=document.createElement('canvas');background.width=850;background.height=456;exportMap.triggerRepaint();await frame();await frame();background.getContext('2d').drawImage(exportMap.getCanvas(),0,0,850,456);background.toDataURL();
  const projected=points.map(p=>exportMap.project(p.coordinates));const stops=route.stops.map(s=>exportMap.project(s.coordinates));
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');
  disk=fileHandle?await fileHandle.createWritable():null;const target=disk?new StreamTarget(new WritableStream({write:chunk=>disk.write(chunk)}),{chunked:true,chunkSize:4*1024*1024}):new BufferTarget();output=new Output({format:new Mp4OutputFormat({fastStart:disk?false:'in-memory'}),target});
  const source=new CanvasSource(canvas,{codec:'avc',quality:new Quality({bitrate:3500000}),keyFrameInterval:2});output.addVideoTrack(source,{frameRate:20});
  let audioSource;
  if(audioTrack){audioSource=new AudioSampleSource({codec:'aac',quality:new Quality({bitrate:128000}),transform:{sampleRate:48000,numberOfChannels:2}});output.addAudioTrack(audioSource);audioIterator=new AudioSampleSink(audioTrack).samples(0,duration);audioNext=await audioIterator.next();}
  await output.start();
  const count=Math.ceil(duration*20);const timestamps=(function*(){for(let i=0;i<count;i++)yield i/20;})();videoIterator=new CanvasSink(videoTrack,{width:640,poolSize:2}).canvasesAtTimestamps(timestamps);
  const clock=timeline(points),matched=matchHazards(points,hazards,route.id);let index=0;
  const text=(value,x,y,size,color='#24353b',bold=false)=>{ctx.fillStyle=color;ctx.font=`${bold?'bold ':''}${size}px Arial`;ctx.fillText(value,x,y);};
  for await(const decoded of videoIterator){
   abort(signal);if(!decoded)throw Error('Falta un fotograma del vídeo.');const t=index/20,dt=Math.min(.05,duration-t),fraction=Math.max(0,Math.min(1,!demoMode&&clock.timed?routeFraction(t,offset,clock.duration):t/duration));const pos=pointAt(points,fraction,clock),loc=exportMap.project(pos.point.coordinates);
   const active=demoMode?Math.min(route.stops.length-1,Math.floor((t+.015)/4)):route.stops.reduce((best,s,i)=>Math.hypot(stops[i].x-loc.x,stops[i].y-loc.y)<Math.hypot(stops[best].x-loc.x,stops[best].y-loc.y)?i:best,0);
   ctx.fillStyle='#f5f5f2';ctx.fillRect(0,0,1280,720);ctx.drawImage(header,0,0,1280,206);
   text(`LÍNEA ${route.line||'—'}  ·  ${route.name}`,24,238,19,'#263b43',true);text(demoMode?'SIMULACIÓN · escena y tiempos ilustrativos':'RECORRIDO · vídeo y mapa',896,238,13,'#cf372c',true);
   ctx.drawImage(background,24,251);ctx.save();ctx.beginPath();ctx.rect(24,251,850,456);ctx.clip();ctx.translate(24,251);
   ctx.strokeStyle='#087d87';ctx.lineWidth=4;ctx.beginPath();projected.slice(0,pos.index+1).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineTo(loc.x,loc.y);ctx.stroke();
   stops.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,i===active?13:10,0,Math.PI*2);ctx.fillStyle=i===active?'#263b43':'#0769aa';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='white';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(String(i+1),p.x,p.y+3);});
   ctx.beginPath();ctx.arc(loc.x,loc.y,7,0,Math.PI*2);ctx.fillStyle='#087d87';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();ctx.restore();ctx.textAlign='left';
   ctx.fillStyle='#17292f';ctx.fillRect(894,251,362,204);const scale=Math.min(362/decoded.canvas.width,204/decoded.canvas.height),vw=decoded.canvas.width*scale,vh=decoded.canvas.height*scale;ctx.drawImage(decoded.canvas,894+(362-vw)/2,251+(204-vh)/2,vw,vh);
   ctx.save();ctx.globalAlpha=.65;ctx.drawImage(watermark,1170,379,75,60);ctx.restore();
   text(route.sourceType==='gpx'?'PUNTO DEL RECORRIDO':'PARADA · PUNTO DE ATENCIÓN',896,487,12,'#d33b2e',true);text(`${String(active+1).padStart(2,'0')} / ${route.stops.length}`,896,520,25,'#24353b',true);
   const name=route.stops[active].name;const words=name.split(' ');let row='',y=552;for(const word of words){ctx.font='bold 17px Arial';if(ctx.measureText(row+' '+word).width>345){text(row,896,y,17,'#24353b',true);y+=23;row=word;}else row+=(row?' ':'')+word;}text(row,896,y,17,'#24353b',true);
   text(`Código ${route.stops[active].code}`,896,615,13,'#6d7b80');text(`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')} / ${Math.floor(duration/60)}:${String(Math.floor(duration%60)).padStart(2,'0')}`,896,647,17,'#24353b',true);ctx.fillStyle='#d9dedb';ctx.fillRect(896,660,360,5);ctx.fillStyle='#0769aa';ctx.fillRect(896,660,360*t/duration,5);
   ctx.fillStyle='#ffffffe8';ctx.fillRect(28,683,432,20);text('© OpenStreetMap contributors · Recorrido GPX del administrador',34,697,11);text('EuskotrenBus · Aula de rutas / AD Mobility',896,697,12,'#6d7b80');
   if(audioSource){while(audioNext&&!audioNext.done&&audioNext.value.timestamp<t+dt){const sample=audioNext.value;try{await audioSource.add(sample);}finally{sample.close();}audioNext=await audioIterator.next();}}
   drawHazard(ctx,activeHazard(matched,points,pos));
   await source.add(t,dt);index++;if(index%10===0){onProgress({percent:Math.round(index/count*99),label:'Creando MP4 con mapa y vídeo…'});await new Promise(r=>setTimeout(r,0));}
  }
  if(audioSource){while(audioNext&&!audioNext.done){abort(signal);const sample=audioNext.value;try{await audioSource.add(sample);}finally{sample.close();}audioNext=await audioIterator.next();}audioSource.close();}
  source.close();abort(signal);onProgress({percent:99,label:'Finalizando archivo…'});await output.finalize();abort(signal);if(disk)await disk.close();done=true;return disk?null:new Blob([target.buffer],{type:'video/mp4'});
 }finally{if(!done){await output?.cancel().catch(()=>{});await disk?.abort().catch(()=>{});}await videoIterator?.return().catch(()=>{});if(audioNext&&!audioNext.done)audioNext.value.close();await audioIterator?.return().catch(()=>{});input?.dispose();exportMap?.remove();host?.remove();}
}
