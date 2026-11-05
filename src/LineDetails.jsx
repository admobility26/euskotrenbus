import React from 'react';
export default function LineDetails({line}){
 return <section className="line-details"><p><strong>{line.number}</strong>{line.internalNumber?` · Nº interno ${line.internalNumber}`:' · Identificador local: la tabla no indica código de concesión'}</p>{(line.outbound||line.inbound)&&<p><strong>Ida:</strong> {line.outbound||'No indicada'} · <strong>Vuelta:</strong> {line.inbound||'No indicada'}</p>}{line.variants.length>0?<><strong>Variantes de la tabla</strong><ul>{line.variants.map(v=><li key={v}>{v}</li>)}</ul></>:<p>La tabla no especifica variantes ni sentidos para este servicio.</p>}</section>;
}
