'use client';

import {useMemo,useState} from 'react';
import PwaInstall from './PwaInstall';

const TABS=['Главная','Остатки','FBS заказы','Wildberries'];
const ICONS={Главная:'⌂',Остатки:'◆','FBS заказы':'≡',Wildberries:'WB'};
const STATUS={NEW:'Новый',PICKING:'На сборке',PICKED:'Собран',PACKED:'Упакован',READY:'Готов к отгрузке',SHIPPED:'Отгружен',CANCELLED:'Отменён'};

async function request(url,options={}){
  const response=await fetch(url,{cache:'no-store',headers:{'content-type':'application/json'},...options});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(json.error||'Не удалось выполнить операцию');
  return json;
}

const number=value=>new Intl.NumberFormat('ru-RU').format(Number(value)||0);
const date=value=>value?new Date(value).toLocaleString('ru-RU'):'—';

export default function SellerPortal({user,data,onRefresh,onLogout}){
  const[tab,setTab]=useState('Главная');
  const[query,setQuery]=useState('');
  const[toast,setToast]=useState('');
  const stock=data.stock||[];
  const orders=data.orders||[];
  const warehouses=data.warehouses||[];
  const totals=useMemo(()=>warehouses.reduce((sum,item)=>({
    physical:sum.physical+(item.physical_qty||0),available:sum.available+(item.available_qty||0),
    reserved:sum.reserved+(item.reserved_qty||0),quarantine:sum.quarantine+(item.quarantine_qty||0)
  }),{physical:0,available:0,reserved:0,quarantine:0}),[warehouses]);
  async function refreshed(message){await onRefresh();setToast(message);window.setTimeout(()=>setToast(''),2600)}

  return <div className="sellerApp">
    <aside className="sellerSide">
      <div className="sellerBrand"><span>F</span><div><b>{user.organization_name}</b><small>Кабинет клиента</small></div></div>
      <div className="sellerClient"><small>МОЯ КОМПАНИЯ</small><b>{user.seller_name}</b><p>Товары и FBS-операции</p></div>
      <nav aria-label="Кабинет клиента">{TABS.map(item=><button key={item} className={tab===item?'active':''} onClick={()=>setTab(item)}><span>{ICONS[item]}</span>{item}</button>)}</nav>
      <div className="sellerProfile"><div className="sellerAvatar">{user.name.slice(0,1).toUpperCase()}</div><div><b>{user.name}</b><small>{user.seller_access_role==='OWNER'?'Владелец кабинета':'Просмотр'}</small></div></div>
    </aside>

    <main className="sellerContent">
      <header className="sellerHeader"><div><p>ЛИЧНЫЙ КАБИНЕТ</p><h1>{tab}</h1><span>{user.seller_name} · данные обновляются автоматически</span></div><div className="sellerHeaderActions"><PwaInstall/><button className="btn ghost" onClick={onLogout}>Выйти</button></div></header>
      {toast&&<div className="toast" role="status">✓ {toast}</div>}
      {tab==='Главная'&&<SellerOverview totals={totals} warehouses={warehouses} orders={orders} setTab={setTab}/>} 
      {tab==='Остатки'&&<SellerStock rows={stock} query={query} setQuery={setQuery}/>} 
      {tab==='FBS заказы'&&<SellerOrders orders={orders} items={data.orderItems||[]}/>} 
      {tab==='Wildberries'&&<SellerWildberries user={user} seller={data.sellers?.[0]} integrations={data.integrations||[]} done={refreshed}/>} 
    </main>

    <nav className="sellerMobile" aria-label="Мобильная навигация">{TABS.map(item=><button key={item} className={tab===item?'active':''} onClick={()=>setTab(item)}><span>{ICONS[item]}</span>{item}</button>)}</nav>
  </div>;
}

function SellerOverview({totals,warehouses,orders,setTab}){
  const active=orders.filter(item=>!['SHIPPED','CANCELLED'].includes(item.status)).length;
  const metrics=[['Физический остаток',totals.physical,'Всего единиц на складах','◆'],['Доступно',totals.available,'Можно продавать','✓'],['В заказах',totals.reserved,'Зарезервировано под FBS','≡'],['Активные заказы',active,'В обработке фулфилментом','→']];
  return <><section className="sellerHero"><div><p>ПОЛНАЯ ПРОЗРАЧНОСТЬ</p><h2>Ваш товар — под контролем.</h2><span>Следите за остатками и заказами на всех складах фулфилмента в одном окне.</span></div><button onClick={()=>setTab('FBS заказы')}>Открыть FBS заказы <b>→</b></button></section>
    <section className="sellerMetrics">{metrics.map(([label,value,note,icon])=><article key={label}><span>{icon}</span><div><small>{label}</small><b>{number(value)}</b><p>{note}</p></div></article>)}</section>
    <section className="sellerPanel"><header><div><h2>Мои склады</h2><p>Остатки по городам и площадкам</p></div><button className="linkButton" onClick={()=>setTab('Остатки')}>Все остатки →</button></header><div className="warehouseCards">{warehouses.length?warehouses.map(item=><article key={item.id}><div className="warehouseTop"><span>⌂</span><div><h3>{item.name}</h3><p>{[item.city,item.address].filter(Boolean).join(' · ')||'Адрес уточняется'}</p></div></div><div className="warehouseNumbers"><div><small>На складе</small><b>{number(item.physical_qty)}</b></div><div><small>Доступно</small><b className="positive">{number(item.available_qty)}</b></div><div><small>В заказах</small><b>{number(item.reserved_qty)}</b></div><div><small>Коробов</small><b>{number(item.box_count)}</b></div></div></article>):<Empty text="Склады ещё не подключены"/>}</div></section>
    <section className="sellerPanel"><header><div><h2>Последние FBS заказы</h2><p>Актуальный статус работы фулфилмента</p></div></header><OrderList orders={orders.slice(0,6)}/></section></>;
}

function SellerStock({rows,query,setQuery}){
  const filtered=rows.filter(item=>`${item.sku} ${item.name} ${item.warehouse_name} ${item.city||''}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="sellerPanel"><header><div><h2>Остатки по складам</h2><p>Без внутренних ячеек склада — только ваши товарные показатели</p></div><label className="sellerSearch"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="SKU, товар или город"/></label></header><div className="sellerTable"><table><thead><tr><th>Товар</th><th>Склад</th><th>На складе</th><th>Доступно</th><th>В заказах</th><th>QC / брак</th></tr></thead><tbody>{filtered.length?filtered.map(item=><tr key={`${item.product_id}-${item.warehouse_id}`}><td data-label="Товар"><b className="sku">{item.sku}</b><span>{item.name}</span></td><td data-label="Склад"><b>{item.warehouse_name}</b><span>{item.city||'—'}</span></td><td data-label="На складе"><strong>{number(item.physical_qty)}</strong></td><td data-label="Доступно"><strong className="positive">{number(item.available_qty)}</strong></td><td data-label="В заказах">{number(item.reserved_qty)}</td><td data-label="QC / брак">{number((item.quarantine_qty||0)+(item.damaged_qty||0))}</td></tr>):<tr><td colSpan="6"><Empty text="По вашему запросу ничего не найдено"/></td></tr>}</tbody></table></div></section>;
}

function SellerOrders({orders,items}){
  const[selected,setSelected]=useState(null);
  const order=orders.find(item=>item.id===selected);
  return <div className="sellerOrders"><section className="sellerPanel"><header><div><h2>FBS заказы</h2><p>Заказы Wildberries и этапы обработки</p></div></header><OrderList orders={orders} select={setSelected}/></section>{order&&<aside className="sellerPanel orderPreview"><button className="previewClose" onClick={()=>setSelected(null)}>×</button><small>ЗАКАЗ</small><h2>{order.order_no}</h2><Status value={order.status}/><dl><div><dt>Создан</dt><dd>{date(order.created_at)}</dd></div><div><dt>Дедлайн</dt><dd>{date(order.deadline)}</dd></div><div><dt>Прогресс</dt><dd>{order.picked_qty}/{order.item_qty} шт.</dd></div></dl><h3>Состав заказа</h3>{items.filter(item=>item.order_id===order.id).map(item=><div className="sellerOrderItem" key={item.id}><div><b>{item.sku}</b><span>{item.product_name}</span></div><strong>{item.picked_qty}/{item.qty}</strong></div>)}</aside>}</div>;
}

function OrderList({orders,select}){
  return <div className="orderList">{orders.length?orders.map(item=><button key={item.id} onClick={()=>select?.(item.id)}><span className="orderSource">{item.wb_order_id?'WB':'FBS'}</span><div><b>{item.order_no}</b><small>{date(item.created_at)} · {item.item_qty||0} шт.</small></div><Status value={item.status}/><strong>{item.picked_qty||0}/{item.item_qty||0}</strong><i>›</i></button>):<Empty text="Заказов пока нет"/>}</div>;
}

function SellerWildberries({user,seller,integrations,done}){
  const[token,setToken]=useState('');
  const[busy,setBusy]=useState('');
  const[error,setError]=useState('');
  const canEdit=user.seller_access_role==='OWNER';
  async function call(body,message){setBusy(body.action);setError('');try{const result=await request('/api/integrations/wildberries',{method:'POST',body:JSON.stringify(body)});await done(message(result))}catch(err){setError(err.message)}finally{setBusy('')}}
  const integration=integrations[0];
  return <div className="wbSellerGrid"><section className="sellerPanel wbSellerIntro"><span className="wbBig">WB</span><p>WILDBERRIES FBS</p><h2>Заказы прямо в кабинет фулфилмента.</h2><div className="wbSteps"><div><b>01</b><span>Введите Marketplace-токен</span></div><div><b>02</b><span>Система проверит доступ</span></div><div><b>03</b><span>Новые заказы загрузятся автоматически</span></div></div><small>Токен хранится на сервере в зашифрованном виде и никогда не показывается сотрудникам склада.</small></section>
    <section className="sellerPanel wbSellerControl">{integration?<><div className="connectedBadge"><i/> ПОДКЛЮЧЕНО</div><h2>{seller?.name}</h2><p>{integration.name} · токен {integration.token_hint}</p><div className="syncStats"><div><small>Последнее обновление</small><b>{date(integration.last_success_at)}</b></div><div><small>Загружено заказов</small><b>{number(integration.imported_orders)}</b></div></div>{integration.last_error&&<div className="notice danger">Последняя синхронизация завершилась ошибкой. Повторите обновление.</div>}{error&&<div className="notice danger">{error}</div>}<button className="btn primary wide" disabled={Boolean(busy)} onClick={()=>call({action:'SYNC',integration_id:integration.id},result=>`Обновлено · новых заказов ${result.imported||0}`)}>{busy?'Обновляем…':'Обновить заказы сейчас'}</button>{canEdit&&<button className="linkButton dangerLink disconnectSeller" onClick={()=>call({action:'DISCONNECT',integration_id:integration.id},()=>`Wildberries отключён`)}>Отключить интеграцию</button>}</>:canEdit?<form onSubmit={event=>{event.preventDefault();call({action:'SAVE',seller_id:seller?.id,token,name:'Wildberries FBS'},result=>`Wildberries подключён · загружено ${result.sync?.imported||0}`)}}><div className="connectedBadge pending">НАСТРОЙКА</div><h2>Подключить магазин</h2><p>В WB Партнёры откройте «Профиль → Интеграции по API» и создайте токен категории «Маркетплейс».</p><label className="field"><span>API-токен Wildberries<small>Не менее 20 символов</small></span><input type="password" autoComplete="off" value={token} onChange={event=>setToken(event.target.value)} placeholder="Вставьте полный токен" required/></label>{error&&<div className="notice danger">{error}</div>}<button className="btn primary wide" disabled={busy||token.length<20}>{busy?'Проверяем и подключаем…':'Подключить Wildberries'}</button></form>:<><div className="connectedBadge pending">НЕТ ПОДКЛЮЧЕНИЯ</div><h2>Wildberries ещё не подключён</h2><p>Попросите владельца клиентского кабинета добавить API-токен.</p></>}</section></div>;
}

function Status({value}){return <span className={`sellerStatus status-${String(value).toLowerCase()}`}>{STATUS[value]||value}</span>}
function Empty({text}){return <div className="sellerEmpty"><span>□</span><b>{text}</b><small>Данные появятся после первой операции</small></div>}
