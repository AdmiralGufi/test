import './globals.css';
export const metadata={
  title:{default:'Fulfillment WMS',template:'%s · Fulfillment WMS'},
  description:'Операционная WMS для FBS-фулфилмента',
  applicationName:'Fulfillment WMS',
  manifest:'/manifest.webmanifest',
  appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:'WMS'},
  formatDetection:{telephone:false},
  icons:{icon:[{url:'/icons/icon-192.png',sizes:'192x192',type:'image/png'}],apple:[{url:'/icons/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]}
};
export const viewport={themeColor:'#111813',width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}){return <html lang="ru"><body>{children}</body></html>}
