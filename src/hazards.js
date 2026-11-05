import {t,getLanguage,translatedField} from './i18n.js';
// Local metric projection for proximity and directional matching on Bilbao GPX tracks.
const rad=Math.PI/180;
export const distance=(a,b)=>Math.hypot((a[0]-b[0])*111320*Math.cos((a[1]+b[1])/2*rad),(a[1]-b[1])*111320);
export const bearing=(a,b)=>(Math.atan2((b[0]-a[0])*Math.cos((a[1]+b[1])/2*rad),b[1]-a[1])/rad+360)%360;
const angle=(a,b)=>Math.abs((a-b+540)%360-180);
export const assignmentMode=(hazard,routeId)=>(Object.hasOwn(hazard.assignments||{},routeId)?hazard.assignments[routeId]:'auto');
export function matchHazards(points,hazards,routeId){
 const cumulative=[0];for(let i=1;i<points.length;i++)cumulative[i]=cumulative[i-1]+distance(points[i-1].coordinates,points[i].coordinates);
 const matches=[];
 for(const h of hazards.filter(h=>h.active)){
  const mode=assignmentMode(h,routeId);if(mode==='exclude')continue;
  let last=-Infinity,nearest=null;
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1];if(a.segment!==b.segment)continue;
   const c=Math.cos(h.coordinates[1]*rad),xy=p=>[(p[0]-h.coordinates[0])*111320*c,(p[1]-h.coordinates[1])*111320];const u=xy(a.coordinates),v=xy(b.coordinates),dx=v[0]-u[0],dy=v[1]-u[1],l=dx*dx+dy*dy;if(l<1)continue;
   const t=Math.max(0,Math.min(1,-(u[0]*dx+u[1]*dy)/l)),separation=Math.hypot(u[0]+t*dx,u[1]+t*dy);
   if(mode==='include'){if(!nearest||separation<nearest.separation)nearest={hazard:h,at:cumulative[i]+t*Math.sqrt(l),separation,manual:true};continue;}
   if(separation>h.radius)continue;
   let before=i,after=i+1;while(before>0&&points[before-1].segment===a.segment&&cumulative[i]-cumulative[before]<25)before--;while(after<points.length-1&&points[after+1].segment===b.segment&&cumulative[after]-cumulative[i+1]<25)after++;
   const p=a.coordinates.map((n,k)=>n+(b.coordinates[k]-n)*t);
   const entry=bearing(points[before].coordinates,p),exit=bearing(p,points[after].coordinates);
   if(h.bearing!==null&&angle(entry,h.bearing)>h.tolerance||h.exitBearing!==null&&angle(exit,h.exitBearing)>h.tolerance)continue;
   const at=cumulative[i]+t*Math.sqrt(l);if(at-last<Math.max(170,h.radius*2))continue;
   matches.push({hazard:h,at});last=at;
  }
  if(nearest)matches.push(nearest);
 }
 return {matches,cumulative};
}
export function activeHazard(matched,points,pos){
 if(!pos?.point||pos.gap)return null;
 const traveled=matched.cumulative[pos.index]+distance(points[pos.index].coordinates,pos.point.coordinates);
 return matched.matches.filter(m=>Math.abs(m.at-traveled)<85&&(m.manual||distance(pos.point.coordinates,m.hazard.coordinates)<85)).sort((a,b)=>Math.abs(a.at-traveled)-Math.abs(b.at-traveled))[0]?.hazard||null;
}
export function drawHazard(ctx,h,language=getLanguage()){
 if(!h)return;ctx.save();ctx.fillStyle='#fffdf5';ctx.strokeStyle='#cf372c';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(44,270,510,240,12);ctx.fill();ctx.stroke();ctx.fillStyle='#cf372c';ctx.font='bold 18px Arial';ctx.fillText(t('⚠ PUNTO CONFLICTIVO',undefined,language),60,299);ctx.fillStyle='#24353b';let y=326;
 for(const [value,size] of [[translatedField(h,'title',language),18],[translatedField(h,'description',language),15]]){ctx.font=`${size===18?'bold ':''}${size}px Arial`;let row='';for(const word of value.split(' ')){if(ctx.measureText(row+' '+word).width>470){if(y<498)ctx.fillText(row,60,y);y+=21;row=word;}else row+=(row?' ':'')+word;}if(y<498)ctx.fillText(row,60,y);y+=24;}ctx.restore();
}
