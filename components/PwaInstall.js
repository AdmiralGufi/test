'use client';
import {useEffect,useState} from 'react';

export default function PwaInstall(){
  const[prompt,setPrompt]=useState(null);
  const[installed,setInstalled]=useState(false);
  const[showIos,setShowIos]=useState(false);

  useEffect(()=>{
    if(!('serviceWorker'in navigator))return;
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
    const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
    setInstalled(standalone);
    const before=event=>{event.preventDefault();setPrompt(event)};
    const done=()=>{setInstalled(true);setPrompt(null)};
    window.addEventListener('beforeinstallprompt',before);
    window.addEventListener('appinstalled',done);
    return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done)};
  },[]);

  if(installed)return <span className="appInstalled"><span aria-hidden="true">✓</span> Приложение</span>;
  async function install(){
    if(prompt){await prompt.prompt();const result=await prompt.userChoice;if(result.outcome==='accepted')setPrompt(null);return}
    setShowIos(true);
  }
  return <><button className="btn installButton" onClick={install}>⇩ Установить</button>{showIos&&<div className="installSheet" role="dialog" aria-modal="true" aria-labelledby="install-title"><div><button className="sheetClose" aria-label="Закрыть" onClick={()=>setShowIos(false)}>×</button><span className="brandMark">F</span><h2 id="install-title">Установить WMS</h2><p><b>iPhone / iPad:</b> нажмите «Поделиться» в Safari, затем «На экран Домой».</p><p><b>Android:</b> откройте меню браузера и выберите «Установить приложение».</p><button className="btn primary wide" onClick={()=>setShowIos(false)}>Понятно</button></div></div>}</>;
}
