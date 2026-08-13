'use client';

import {cloneElement,useEffect,useId,useRef,useState} from 'react';
import PwaInstall from './PwaInstall';

const ROLE_TABS={
  ADMIN:['Обзор','Скан','Приёмка','Короба','Товары','Клиенты','Заказы','Устройства','Сотрудники','Журнал'],
  MANAGER:['Обзор','Скан','Приёмка','Короба','Товары','Клиенты','Заказы','Устройства','Журнал'],
  RECEIVER:['Обзор','Скан','Приёмка','Короба','Товары','Устройства'],
  PICKER:['Обзор','Скан','Короба','Заказы','Устройства'],
  PACKER:['Обзор','Скан','Короба','Заказы','Устройства'],
  SHIPPER:['Обзор','Скан','Заказы','Устройства'],
  VIEWER:['Обзор','Скан','Короба','Товары','Заказы']
};
const MOBILE=['Обзор','Скан','Приёмка','Короба','Заказы'];
const ICONS={Обзор:'⌂',Скан:'⌗',Приёмка:'↓',Короба:'□',Товары:'◆',Клиенты:'◎',Заказы:'≡',Устройства:'⌁',Сотрудники:'♙',Журнал:'◷'};
const STATUS_LABELS={NEW:'Новый',PICKING:'Сборка',PICKED:'Собран',PACKED:'Упакован',READY:'Готов',SHIPPED:'Отгружен',CANCELLED:'Отменён'};

async function api(url,options={}){
  const response=await fetch(url,{cache:'no-store',headers:{'content-type':'application/json',...(options.headers||{})},...options});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(json.error||'Не удалось выполнить операцию');
  return json;
}
const ops=body=>api('/api/ops',{method:'POST',body:JSON.stringify(body)});

export default function WmsAppV3(){
  const[state,setState]=useState({loading:true});
  const[tab,setTab]=useState('Обзор');
  const[toast,setToast]=useState('');
  const[modal,setModal]=useState(null);
  const[query,setQuery]=useState('');

  async function load({quiet=false}={}){
    try{
      if(!quiet)setState(current=>({...current,loading:true}));
      setState(await api('/api/bootstrap'));
    }catch(error){setState(current=>({...current,loading:false,error:error.message}))}
  }
  useEffect(()=>{load()},[]);
  async function refresh(message){
    await load({quiet:true});
    if(message){setToast(message);window.setTimeout(()=>setToast(''),2600)}
  }

  if(state.loading)return <Loading/>;
  if(state.error)return <ErrorState message={state.error} retry={()=>load()}/>;
  if(state.setupRequired)return <Auth setup done={()=>load()}/>;
  if(!state.user)return <Auth done={()=>load()}/>;

  const data=state.data||{};
  const tabs=ROLE_TABS[state.user.role]||ROLE_TABS.VIEWER;
  const visible=tabs.includes(tab)?tab:'Обзор';
  const boxes=(data.boxes||[]).filter(box=>
    `${box.box_code} ${box.seller_name||''} ${box.zone_name||''} ${box.cell_code||''}`
      .toLowerCase().includes(query.toLowerCase())
  );

  return <div className="app">
    <aside className="side">
      <div className="brand"><span className="brandMark">F</span><span>Fulfillment<small>Warehouse OS</small></span></div>
      <nav className="nav" aria-label="Основная навигация">
        {tabs.map(item=><button key={item} className={visible===item?'active':''} aria-current={visible===item?'page':undefined} onClick={()=>setTab(item)}><span aria-hidden="true">{ICONS[item]}</span>{item}</button>)}
      </nav>
      <div className="profile"><span className="online" aria-hidden="true"/><div><b>{state.user.name}</b><small>{state.user.role}</small></div></div>
    </aside>

    <main className="content" id="main-content">
      <header className="pageHeader">
        <div><p className="eyebrow">FULFILLMENT CONTROL CENTER</p><h1>{visible}</h1><p className="subtitle">FBS · единая база склада · ТСД и телефон</p></div>
        <div className="actions"><PwaInstall/><button className="btn primary" onClick={()=>setTab('Скан')}>⌗ Сканировать</button><button className="btn ghost" onClick={async()=>{await api('/api/auth/logout',{method:'POST'});load()}}>Выйти</button></div>
      </header>
      {toast&&<div className="toast" role="status">✓ {toast}</div>}
      <Metrics data={data}/>
      {visible==='Обзор'&&<Overview data={data} setTab={setTab}/>}
      {visible==='Скан'&&<Scanner/>}
      {visible==='Приёмка'&&<Receiving data={data} done={refresh}/>}
      {visible==='Короба'&&<Boxes rows={boxes} query={query} setQuery={setQuery} open={setModal}/>}
      {visible==='Товары'&&<Products data={data} done={refresh}/>}
      {visible==='Клиенты'&&<Clients data={data} done={refresh}/>}
      {visible==='Заказы'&&<Orders data={data} role={state.user.role} done={refresh}/>}
      {visible==='Устройства'&&<Devices data={data} done={refresh}/>}
      {visible==='Сотрудники'&&<Users data={data} done={refresh}/>}
      {visible==='Журнал'&&<Audit data={data}/>}
    </main>

    <nav className="mobilebar" aria-label="Мобильная навигация">
      {MOBILE.filter(item=>tabs.includes(item)).map(item=><button key={item} className={visible===item?'active':''} aria-current={visible===item?'page':undefined} onClick={()=>setTab(item)}><span aria-hidden="true">{ICONS[item]}</span>{item}</button>)}
    </nav>
    {modal&&<BoxModal spec={modal} data={data} close={()=>setModal(null)} done={async message=>{setModal(null);await refresh(message)}}/>}
  </div>;
}

function Loading(){return <main className="statePage" aria-live="polite"><div className="loader"/><h1>Загружаем склад</h1><p>Получаем актуальные остатки и задания…</p></main>}
function ErrorState({message,retry}){return <main className="statePage"><div className="stateIcon danger">!</div><h1>Нет связи с WMS</h1><p>{message}</p><button className="btn primary" onClick={retry}>Повторить</button></main>}
function ErrorMessage({children}){return children?<div className="notice danger" role="alert">{children}</div>:null}

function Auth({setup=false,done}){
  const[form,setForm]=useState({name:'',email:'',password:''});
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);
  async function submit(event){
    event?.preventDefault();
    if(busy)return;
    setBusy(true);setError('');
    try{await api(setup?'/api/auth/setup':'/api/auth/login',{method:'POST',body:JSON.stringify(form)});await done()}
    catch(err){setError(err.message)}
    finally{setBusy(false)}
  }
  return <main className="authShell">
    <section className="authVisual" aria-hidden="true"><div className="authBrand"><span className="brandMark">F</span> Fulfillment WMS</div><div className="visualCopy"><span className="pill">WAREHOUSE OS</span><h1>Склад в одном рабочем контуре.</h1><p>Приёмка, адресное хранение, picking и отгрузка — без разрывов между данными и операциями.</p></div><div className="visualGrid"><span/><span/><span/><span/><span/><span/></div></section>
    <section className="authPanel"><form className="authCard" onSubmit={submit}><p className="eyebrow">{setup?'ПЕРВЫЙ ЗАПУСК':'ЗАЩИЩЁННЫЙ ВХОД'}</p><h2>{setup?'Создание администратора':'Добро пожаловать'}</h2><p className="subtitle">{setup?'Настройте владельца системы. Позже сотрудников можно добавить по ролям.':'Войдите в рабочую панель склада.'}</p>
      {setup&&<Field label="Имя администратора"><input autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></Field>}
      <Field label="Email"><input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></Field>
      <Field label="Пароль" hint={setup?'Минимум 8 символов':undefined}><input type="password" autoComplete={setup?'new-password':'current-password'} minLength={8} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></Field>
      <ErrorMessage>{error}</ErrorMessage>
      <button className="btn primary wide" disabled={busy}>{busy?'Подождите…':setup?'Создать администратора':'Войти в WMS'}</button>
    </form></section>
  </main>;
}

function Field({label,hint,children}){
  const id=useId();
  return <label className="field" htmlFor={id}><span>{label}{hint&&<small>{hint}</small>}</span>{cloneElement(children,{id})}</label>;
}

function Metrics({data}){
  const items=[
    ['Короба',data.boxes?.length||0,'□','Всего в системе'],
    ['SKU',data.products?.length||0,'◆','Активный каталог'],
    ['Заказы',data.orders?.length||0,'≡','FBS поток'],
    ['Клиенты',data.sellers?.length||0,'◎','Владельцы товара']
  ];
  return <section className="metrics" aria-label="Ключевые показатели">{items.map(([label,value,icon,note])=><article className="metric" key={label}><span className="metricIcon" aria-hidden="true">{icon}</span><div><small>{label}</small><b>{value}</b><p>{note}</p></div></article>)}</section>;
}

function Overview({data,setTab}){
  const stages=[['Приёмка','RCV'],['QC','QC'],['Сортировка','SRT'],['Хранение','STG'],['Picking','PCK'],['Packing','PAK'],['Готово','RDY'],['Отгрузка','SHP']];
  return <div className="dashboardGrid">
    <section className="card span2"><SectionTitle title="Операционный поток" text="Текущее распределение коробов по зонам"/>
      <div className="flow">{stages.map(([name,code],index)=><button className="flowStep" key={code} onClick={()=>setTab(code==='RCV'?'Приёмка':['PCK','PAK','RDY','SHP'].includes(code)?'Заказы':'Короба')}><span className="flowIndex">{String(index+1).padStart(2,'0')}</span><b>{name}</b><strong>{(data.boxes||[]).filter(box=>box.zone_code===code).length}</strong><small>коробов</small></button>)}</div>
    </section>
    <section className="card"><SectionTitle title="Быстрые действия" text="Частые операции в один переход"/><div className="quickActions"><button className="quick primaryQuick" onClick={()=>setTab('Скан')}><span>⌗</span><div><b>Скан-центр</b><small>Короб, SKU, ячейка</small></div><i>→</i></button><button className="quick" onClick={()=>setTab('Приёмка')}><span>↓</span><div><b>Принять короб</b><small>Новая поставка</small></div><i>→</i></button><button className="quick" onClick={()=>setTab('Заказы')}><span>≡</span><div><b>FBS заказы</b><small>Picking и packing</small></div><i>→</i></button></div></section>
    <section className="card span3"><SectionTitle title="Состояние склада" text="Контрольные сигналы"/><div className="healthRow"><Health label="База данных" value="Подключена" ok/><Health label="Устройства" value={`${data.devices?.filter(x=>x.active).length||0} активно`} ok/><Health label="Новые заказы" value={String(data.orders?.filter(x=>x.status==='NEW').length||0)}/><Health label="Готовы к отгрузке" value={String(data.orders?.filter(x=>x.status==='READY').length||0)}/></div></section>
  </div>;
}
function Health({label,value,ok=false}){return <div className="health"><span className={ok?'dot okDot':'dot'}/><div><small>{label}</small><b>{value}</b></div></div>}
function SectionTitle({title,text,action}){return <header className="sectionTitle"><div><h2>{title}</h2>{text&&<p>{text}</p>}</div>{action}</header>}

function Scanner(){
  const[code,setCode]=useState('');
  const[result,setResult]=useState(null);
  const[camera,setCamera]=useState(false);
  const[busy,setBusy]=useState(false);
  const video=useRef(null),controls=useRef(null);
  async function lookup(input=code){
    const value=String(input||'').trim();
    if(!value||busy)return;
    setBusy(true);setResult(null);
    try{setResult(await api('/api/scan',{method:'POST',body:JSON.stringify({barcode:value})}));setCode('')}
    catch(error){setResult({error:error.message})}
    finally{setBusy(false)}
  }
  useEffect(()=>{
    if(!camera)return;
    let stopped=false;
    async function start(){
      try{
        const {BrowserMultiFormatReader}=await import('@zxing/browser');
        const reader=new BrowserMultiFormatReader();
        controls.current=await reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}}},video.current,(found)=>{
          if(found&&!stopped){stopped=true;controls.current?.stop();setCamera(false);lookup(found.getText())}
        });
      }catch(error){setResult({error:'Не удалось запустить камеру. Проверьте разрешение браузера.'});setCamera(false)}
    }
    start();
    return()=>{stopped=true;controls.current?.stop()}
  },[camera]);
  return <section className="card scannerCard"><SectionTitle title="Скан-центр" text="ТСД работает в режиме HID/Keyboard: сканирование завершается клавишей Enter"/>
    <div className="scanner"><span className="scanGlyph" aria-hidden="true">⌗</span><label htmlFor="scan-input">Штрихкод или внутренний код</label><input id="scan-input" autoFocus value={code} placeholder="BOX / SKU / ячейка / заказ" onChange={e=>setCode(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')lookup()}}/><div className="actions center"><button className="btn primary" disabled={!code.trim()||busy} onClick={()=>lookup()}>{busy?'Ищем…':'Распознать'}</button><button className="btn" aria-pressed={camera} onClick={()=>setCamera(value=>!value)}>{camera?'Закрыть камеру':'Камера телефона'}</button></div>{camera&&<video ref={video} className="camera" playsInline muted aria-label="Изображение с камеры"/>}{result&&<div className={`scanResult ${result.error?'errorResult':'successResult'}`} role="status">{result.error?<><b>Код не распознан</b><p>{result.error}</p></>:<><span className="resultType">{result.kind}</span><h3>{result.code}</h3><p>{result.title}</p><small>{result.location}</small></>}</div>}</div>
  </section>;
}

function Receiving({data,done}){
  const[form,setForm]=useState({seller_id:'',box_code:'',notes:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function save(event){event.preventDefault();setBusy(true);setError('');try{await ops({action:'CREATE_BOX',...form});setForm({seller_id:'',box_code:'',notes:''});await done('Короб принят')}catch(err){setError(err.message)}finally{setBusy(false)}}
  return <section className="card formCard"><SectionTitle title="Приёмка короба" text="Короб будет зарегистрирован в зоне «Приёмка»"/>{!data.sellers?.length&&<div className="notice danger">Сначала создайте клиента во вкладке «Клиенты».</div>}<form className="formGrid" onSubmit={save}><Field label="Клиент"><select value={form.seller_id} onChange={e=>setForm({...form,seller_id:e.target.value})} required><option value="">Выберите клиента</option>{data.sellers?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Код короба" hint="Можно отсканировать ТСД"><input value={form.box_code} onChange={e=>setForm({...form,box_code:e.target.value})} placeholder="Сгенерируется автоматически"/></Field><Field label="Комментарий"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows="3"/></Field><ErrorMessage>{error}</ErrorMessage><button className="btn primary" disabled={busy||!form.seller_id}>{busy?'Принимаем…':'Принять короб'}</button></form></section>;
}

function Boxes({rows,query,setQuery,open}){return <section className="card"><SectionTitle title="Короба" text={`Найдено: ${rows.length}`} action={<label className="search"><span aria-hidden="true">⌕</span><input aria-label="Поиск коробов" value={query} placeholder="Короб, клиент, ячейка…" onChange={e=>setQuery(e.target.value)}/></label>}/><DataTable heads={['Короб','Клиент','Зона','Ячейка','Единиц','Действия']} empty="Короба не найдены" rows={rows.map(box=>[<b className="mono">{box.box_code}</b>,box.seller_name,<Status value={box.zone_name}/>,box.cell_code||'—',box.item_qty||0,<div className="rowActions"><button className="btn small" onClick={()=>open({kind:'item',id:box.id,sellerId:box.seller_id})}>+ SKU</button><button className="btn small" onClick={()=>open({kind:'move',id:box.id})}>Переместить</button></div>])}/></section>}

function Products({data,done}){
  const[form,setForm]=useState({seller_id:'',sku:'',name:'',barcode:''}),[error,setError]=useState('');
  async function save(event){event.preventDefault();setError('');try{await ops({action:'CREATE_PRODUCT',...form});setForm({seller_id:'',sku:'',name:'',barcode:''});done('SKU добавлен')}catch(err){setError(err.message)}}
  return <section className="card"><SectionTitle title="Товары" text="Каталог активных SKU"/><form className="inlineForm" onSubmit={save}><Field label="Клиент"><select value={form.seller_id} onChange={e=>setForm({...form,seller_id:e.target.value})} required><option value="">Выберите</option>{data.sellers?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="SKU"><input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} required/></Field><Field label="Название"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></Field><Field label="Штрихкод"><input value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})}/></Field><button className="btn primary">Добавить</button></form><ErrorMessage>{error}</ErrorMessage><DataTable heads={['SKU','Название','Клиент','Штрихкод']} empty="Каталог пуст" rows={(data.products||[]).map(p=>[<b className="mono">{p.sku}</b>,p.name,p.seller_name,p.wb_barcode||'—'])}/></section>;
}

function Clients({data,done}){
  const[form,setForm]=useState({name:'',contact:'',phone:'',email:''}),[error,setError]=useState('');
  async function save(event){event.preventDefault();setError('');try{await ops({action:'CREATE_SELLER',...form});setForm({name:'',contact:'',phone:'',email:''});done('Клиент добавлен')}catch(err){setError(err.message)}}
  return <section className="card"><SectionTitle title="Клиенты" text="Владельцы товара и контактные данные"/><form className="inlineForm" onSubmit={save}><Field label="Название"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></Field><Field label="Контакт"><input value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/></Field><Field label="Телефон"><input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Field><Field label="Email"><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field><button className="btn primary">Добавить</button></form><ErrorMessage>{error}</ErrorMessage><DataTable heads={['Клиент','Контакт','Телефон','Email']} empty="Клиентов пока нет" rows={(data.sellers||[]).map(s=>[<b>{s.name}</b>,s.contact_name||'—',s.phone||'—',s.email||'—'])}/></section>;
}

function Orders({data,role,done}){
  const[selected,setSelected]=useState(null);
  const order=data.orders?.find(item=>item.id===selected);
  const items=data.orderItems?.filter(item=>item.order_id===selected)||[];
  return <div className="ordersGrid"><section className="card"><SectionTitle title="FBS заказы" text={`Всего: ${data.orders?.length||0}`} action={['ADMIN','MANAGER'].includes(role)?<OrderCreate data={data} done={done}/>:null}/><DataTable heads={['Заказ','Клиент','Статус','Дедлайн']} empty="Заказов пока нет" rows={(data.orders||[]).map(item=>[<button className="linkButton mono" onClick={()=>setSelected(item.id)}>{item.order_no}</button>,item.seller_name,<Status value={STATUS_LABELS[item.status]||item.status} tone={item.status}/>,item.deadline?new Date(item.deadline).toLocaleString('ru-RU'):'—'])}/></section>{order&&<section className="card orderDetail"><SectionTitle title={order.order_no} text={order.seller_name}/><Status value={STATUS_LABELS[order.status]||order.status} tone={order.status}/>{items.map(item=><PickLine key={item.id} item={item} data={data} role={role} done={done}/>)}<OrderActions order={order} role={role} done={done}/></section>}</div>;
}

function OrderCreate({data,done}){
  const[open,setOpen]=useState(false);
  const[form,setForm]=useState({seller_id:'',order_no:'',deadline:'',priority:'NORMAL'});
  const[line,setLine]=useState({product_id:'',qty:1});
  const[items,setItems]=useState([]),[error,setError]=useState('');
  function add(){const qty=Number(line.qty);if(!line.product_id||!Number.isInteger(qty)||qty<1)return;const product=data.products?.find(x=>x.id===line.product_id);setItems(current=>[...current,{product_id:line.product_id,qty,label:product?`${product.sku} — ${product.name}`:line.product_id}]);setLine({product_id:'',qty:1})}
  async function save(){setError('');try{await ops({action:'CREATE_ORDER',...form,deadline:form.deadline||null,items:items.map(({product_id,qty})=>({product_id,qty}))});setOpen(false);setItems([]);done('Заказ создан')}catch(err){setError(err.message)}}
  return <><button className="btn primary" onClick={()=>setOpen(true)}>+ Новый заказ</button>{open&&<Modal title="Новый FBS заказ" close={()=>setOpen(false)}><div className="formGrid"><Field label="Клиент"><select value={form.seller_id} onChange={e=>setForm({...form,seller_id:e.target.value})} required><option value="">Выберите</option>{data.sellers?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Номер заказа" hint="Необязательно"><input value={form.order_no} onChange={e=>setForm({...form,order_no:e.target.value})}/></Field><Field label="Дедлайн"><input type="datetime-local" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/></Field><Field label="Приоритет"><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="NORMAL">Обычный</option><option value="HIGH">Высокий</option><option value="URGENT">Срочный</option><option value="LOW">Низкий</option></select></Field><div className="lineBuilder"><Field label="SKU"><select value={line.product_id} onChange={e=>setLine({...line,product_id:e.target.value})}><option value="">Выберите</option>{data.products?.filter(p=>!form.seller_id||p.seller_id===form.seller_id).map(p=><option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select></Field><Field label="Количество"><input type="number" min="1" step="1" value={line.qty} onChange={e=>setLine({...line,qty:e.target.value})}/></Field><button className="btn" type="button" onClick={add}>Добавить</button></div><div className="orderLines">{items.map((item,index)=><div key={item.product_id+index}><span>{item.label}</span><b>× {item.qty}</b><button aria-label={`Удалить ${item.label}`} onClick={()=>setItems(current=>current.filter((_,i)=>i!==index))}>×</button></div>)}</div><ErrorMessage>{error}</ErrorMessage><div className="modalActions"><button className="btn" onClick={()=>setOpen(false)}>Отмена</button><button className="btn primary" disabled={!form.seller_id||!items.length} onClick={save}>Создать заказ</button></div></div></Modal>}</>;
}

function PickLine({item,data,role,done}){
  const[box,setBox]=useState(''),[qty,setQty]=useState(1),[error,setError]=useState('');
  const left=Math.max(0,item.qty-item.picked_qty);
  const candidates=(data.boxItems||[]).filter(x=>x.product_id===item.product_id&&x.qty>0);
  async function pick(){setError('');try{await ops({action:'PICK_ITEM',order_item_id:item.id,box_id:box,qty:Number(qty)});done('Позиция собрана')}catch(err){setError(err.message)}}
  return <article className="pickLine"><div className="pickHead"><div><b>{item.sku}</b><p>{item.product_name}</p></div><strong>{item.picked_qty}/{item.qty}</strong></div><div className="progress"><span style={{width:`${Math.min(100,(item.picked_qty/item.qty)*100)}%`}}/></div>{left>0&&['ADMIN','MANAGER','PICKER'].includes(role)&&<div className="pickControls"><select aria-label="Короб-источник" value={box} onChange={e=>setBox(e.target.value)}><option value="">Короб-источник</option>{candidates.map(c=><option key={c.box_id} value={c.box_id}>{c.box_code} · {c.cell_code||'без ячейки'} · {c.qty} шт.</option>)}</select><input aria-label="Количество для сборки" type="number" min="1" max={left} step="1" value={qty} onChange={e=>setQty(e.target.value)}/><button className="btn primary small" disabled={!box} onClick={pick}>Собрать</button></div>}<ErrorMessage>{error}</ErrorMessage></article>;
}

function OrderActions({order,role,done}){
  const[error,setError]=useState('');
  const config=order.status==='PICKED'&&['ADMIN','MANAGER','PACKER'].includes(role)?['ORDER_PACKED','Подтвердить упаковку','Заказ упакован']:order.status==='PACKED'&&['ADMIN','MANAGER','PACKER'].includes(role)?['ORDER_READY','Готов к отгрузке','Статус изменён']:order.status==='READY'&&['ADMIN','MANAGER','PACKER','SHIPPER'].includes(role)?['ORDER_SHIPPED','Отгрузить заказ','Заказ отгружен']:null;
  if(!config)return null;
  return <div className="orderActions"><ErrorMessage>{error}</ErrorMessage><button className="btn primary wide" onClick={async()=>{setError('');try{await ops({action:config[0],order_id:order.id});done(config[2])}catch(err){setError(err.message)}}}>{config[1]}</button></div>;
}

function Devices({data,done}){
  const[form,setForm]=useState({device_type:'TSD',label:'',device_code:''}),[error,setError]=useState('');
  async function register(event){event.preventDefault();setError('');try{const result=await ops({action:'REGISTER_DEVICE',...form,platform:navigator.platform,user_agent:navigator.userAgent});done('Устройство подключено: '+result.device_code)}catch(err){setError(err.message)}}
  return <section className="card"><SectionTitle title="Устройства" text="Привязка ТСД, телефонов и планшетов к рабочему месту"/><div className="infoBanner"><b>ТСД:</b> включите HID/Keyboard и суффикс Enter. <b>Телефон:</b> разрешите доступ к камере.</div><form className="inlineForm" onSubmit={register}><Field label="Тип"><select value={form.device_type} onChange={e=>setForm({...form,device_type:e.target.value})}><option>TSD</option><option>PHONE</option><option>TABLET</option></select></Field><Field label="Название"><input value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></Field><Field label="Код" hint="Необязательно"><input value={form.device_code} onChange={e=>setForm({...form,device_code:e.target.value})}/></Field><button className="btn primary">Подключить</button></form><ErrorMessage>{error}</ErrorMessage><DataTable heads={['Код','Тип','Название','Статус']} empty="Нет подключённых устройств" rows={(data.devices||[]).map(item=>[<b className="mono">{item.device_code}</b>,item.device_type,item.label||'—',<Status value={item.active?'Активно':'Отключено'} tone={item.active?'READY':'CANCELLED'}/>])}/></section>;
}

function Users({data,done}){
  const[form,setForm]=useState({name:'',email:'',password:'',role:'RECEIVER'}),[error,setError]=useState('');
  async function save(event){event.preventDefault();setError('');try{await ops({action:'CREATE_USER',...form});setForm({name:'',email:'',password:'',role:'RECEIVER'});done('Сотрудник создан')}catch(err){setError(err.message)}}
  return <section className="card"><SectionTitle title="Сотрудники и роли" text="Доступ к операциям ограничивается ролью"/><form className="inlineForm" onSubmit={save}><Field label="Имя"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></Field><Field label="Email"><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></Field><Field label="Пароль" hint="Минимум 8 символов"><input type="password" minLength="8" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></Field><Field label="Роль"><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{Object.keys(ROLE_TABS).map(role=><option key={role}>{role}</option>)}</select></Field><button className="btn primary">Создать</button></form><ErrorMessage>{error}</ErrorMessage><DataTable heads={['Имя','Email','Роль','Статус']} empty="Нет сотрудников" rows={(data.users||[]).map(user=>[<b>{user.name}</b>,user.email,<Status value={user.role}/>,<Status value={user.active?'Активен':'Отключён'} tone={user.active?'READY':'CANCELLED'}/>])}/></section>;
}

function Audit({data}){return <section className="card"><SectionTitle title="Журнал операций" text="Последние 500 действий в системе"/><DataTable heads={['Дата','Пользователь','Действие','Объект']} empty="Журнал пуст" rows={(data.audit||[]).map(item=>[new Date(item.created_at).toLocaleString('ru-RU'),item.user_name||'system',<span className="mono">{item.action}</span>,item.entity_type||'—'])}/></section>}

function Status({value,tone=''}){return <span className={`status status-${String(tone).toLowerCase()}`}>{value}</span>}
function DataTable({heads,rows,empty}){
  return <div className="tableWrap"><table><thead><tr>{heads.map(head=><th key={head} scope="col">{head}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,index)=><tr key={index}>{row.map((cell,i)=><td key={i} data-label={heads[i]}>{cell}</td>)}</tr>):<tr><td colSpan={heads.length}><div className="emptyState"><span>□</span><b>{empty}</b><small>Данные появятся после первой операции</small></div></td></tr>}</tbody></table></div>;
}

function Modal({title,close,children}){
  const ref=useRef(null);
  useEffect(()=>{const previous=document.activeElement;ref.current?.focus();const handler=event=>{if(event.key==='Escape')close()};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);previous?.focus?.()}},[close]);
  return <div className="modalBackdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex="-1" ref={ref}><header><h2 id="modal-title">{title}</h2><button className="iconButton" aria-label="Закрыть" onClick={close}>×</button></header>{children}</section></div>;
}

function BoxModal({spec,data,close,done}){
  const[form,setForm]=useState({target:'',reason:'',product_id:'',qty:1}),[error,setError]=useState('');
  const products=(data.products||[]).filter(product=>!spec.sellerId||product.seller_id===spec.sellerId);
  async function save(){
    setError('');
    try{
      if(spec.kind==='move'){const[target_type,target_id]=form.target.split(':');await ops({action:'MOVE_BOX',box_id:spec.id,target_type,target_id,reason:form.reason||'Перемещение'});done('Короб перемещён')}
      else{await ops({action:'ADD_BOX_ITEM',box_id:spec.id,product_id:form.product_id,qty:Number(form.qty)});done('SKU добавлен в короб')}
    }catch(err){setError(err.message)}
  }
  return <Modal title={spec.kind==='move'?'Перемещение короба':'Добавление SKU'} close={close}><div className="formGrid">{spec.kind==='move'?<><Field label="Зона или ячейка"><select value={form.target} onChange={e=>setForm({...form,target:e.target.value})} required><option value="">Выберите место</option><optgroup label="Зоны">{data.zones?.map(z=><option key={z.id} value={`zone:${z.id}`}>{z.name}</option>)}</optgroup><optgroup label="Ячейки">{data.cells?.map(c=><option key={c.id} value={`cell:${c.id}`}>{c.code}</option>)}</optgroup></select></Field><Field label="Причина"><input value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></Field></>:<><Field label="Товар"><select value={form.product_id} onChange={e=>setForm({...form,product_id:e.target.value})} required><option value="">Выберите SKU</option>{products.map(p=><option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select></Field><Field label="Количество"><input type="number" min="1" step="1" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})}/></Field></>}<ErrorMessage>{error}</ErrorMessage><div className="modalActions"><button className="btn" onClick={close}>Отмена</button><button className="btn primary" disabled={spec.kind==='move'?!form.target:!form.product_id} onClick={save}>Подтвердить</button></div></div></Modal>;
}
