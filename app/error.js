'use client';

import {useEffect} from 'react';

export default function ErrorPage({error,reset}){
  useEffect(()=>{console.error('WMS UI failure',error)},[error]);
  return <main className="statePage"><div className="stateIcon danger">!</div><h1>Не удалось открыть экран</h1><p>Данные не изменены. Повторите загрузку или вернитесь позже.</p><button className="btn primary" onClick={reset}>Повторить</button></main>;
}
