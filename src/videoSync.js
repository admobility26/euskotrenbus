export const syncOffset=(routeSeconds,videoSeconds)=>{if(!Number.isFinite(routeSeconds)||!Number.isFinite(videoSeconds)||routeSeconds<0||videoSeconds<0)throw Error('Selecciona instantes válidos.');return videoSeconds-routeSeconds;};
export const routeFraction=(videoSeconds,offset,routeDuration)=>Math.max(0,Math.min(1,(videoSeconds-offset)/routeDuration));
export const videoSecond=(fraction,routeDuration,offset)=>Math.max(0,fraction*routeDuration+offset);
export function exportLimit(duration,disk){if(!(duration>0)||duration>3600.1)throw Error('Exporta cada sentido por separado: máximo una hora por vídeo.');if(duration>300&&!disk)throw Error('Para exportar más de cinco minutos abre la aplicación local en Chrome o Edge y guarda directamente en disco.');}
