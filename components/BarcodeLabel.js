'use client';

import {useEffect,useRef} from 'react';

export default function BarcodeLabel({value,title,subtitle,meta=[]}){
  const svg=useRef(null);
  useEffect(()=>{
    let active=true;
    import('jsbarcode').then(module=>{
      if(active&&svg.current)module.default(svg.current,String(value),{format:'CODE128',displayValue:true,fontSize:18,height:72,margin:10});
    });
    return()=>{active=false};
  },[value]);
  return <article className="printLabel"><div className="labelBrand">FULFILLMENT WMS</div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}<svg ref={svg} aria-label={`Штрихкод ${value}`}/><dl>{meta.map(([name,item])=><div key={name}><dt>{name}</dt><dd>{item||'—'}</dd></div>)}</dl></article>;
}
