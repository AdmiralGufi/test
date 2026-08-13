export default function manifest(){
  return {
    name:'Fulfillment WMS',
    short_name:'WMS',
    description:'Операционная WMS для FBS-фулфилмента',
    start_url:'/',
    scope:'/',
    display:'standalone',
    orientation:'any',
    background_color:'#f4f6f3',
    theme_color:'#111813',
    categories:['business','productivity','utilities'],
    lang:'ru',
    icons:[
      {src:'/icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any maskable'},
      {src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}
    ],
    shortcuts:[
      {name:'Скан-центр',short_name:'Скан',description:'Сканировать короб, SKU, ячейку или заказ',url:'/?tab=scan',icons:[{src:'/icons/icon-192.png',sizes:'192x192'}]},
      {name:'Приёмка',short_name:'Приёмка',description:'Принять новый короб',url:'/?tab=receiving',icons:[{src:'/icons/icon-192.png',sizes:'192x192'}]}
    ]
  };
}
