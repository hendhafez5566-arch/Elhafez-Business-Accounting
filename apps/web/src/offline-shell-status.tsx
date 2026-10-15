import { useEffect, useState } from 'react';

export function OfflineShellStatus() {
 const [offline,setOffline]=useState(()=>!navigator.onLine);
 const [failure,setFailure]=useState(false);
 useEffect(()=>{
  const update=()=>setOffline(!navigator.onLine);
  window.addEventListener('online',update);window.addEventListener('offline',update);
  if('serviceWorker' in navigator){
   void navigator.serviceWorker.register('/offline-worker.js',{scope:'/',updateViaCache:'none'}).catch(()=>setFailure(true));
  }else setFailure(true);
  return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};
 },[]);
 if(!offline&&!failure)return null;
 return <aside role="status" dir="rtl">{offline
  ?'الإنترنت غير متصل. فتح الواجهة المحفوظة لا يؤكد الاتصال بالخادم؛ تسجيل الدخول والعمليات المعتمدة تحتاج الخادم، والطلبات المحلية تُرسل يدويًا عند الاتصال.'
  :'تعذر تجهيز نسخة الواجهة للعمل دون إنترنت. يمكنك متابعة العمل المتصل والمحاولة عند فتح النظام مجددًا.'}</aside>;
}
