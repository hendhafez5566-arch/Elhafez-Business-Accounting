import{useEffect,useMemo,useState}from'react';
import{ActionBar,Badge,Button,Card,DataGrid,EmptyState,ErrorState,LoadingState,MetricCard,Tabs,Toast}from'./ui.js';
import{HttpNotificationCenterClient,type NotificationCenterClient,type NotificationItem}from'./notification-center-client.js';
import{tenantApiContext}from'./tenant-session.js';

type Filter='all'|'unread'|'read';
function text(payload:Readonly<Record<string,unknown>>,key:string,fallback:string){const value=payload[key];return typeof value==='string'&&value.trim()?value.trim():fallback;}
function severity(item:NotificationItem){const value=text(item.payload,'severity','INFO').toUpperCase();return value==='CRITICAL'||value==='HIGH'?'warning':item.readAt?'neutral':'info' as const;}
function route(item:NotificationItem){const value=item.payload.route;return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')?value:null;}

export function NotificationCenterPage({client=new HttpNotificationCenterClient()}:{client?:NotificationCenterClient}={}){
 const context=tenantApiContext(),[items,setItems]=useState<readonly NotificationItem[]>([]),[unreadCount,setUnreadCount]=useState(0),[filter,setFilter]=useState<Filter>('all'),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){if(!context.token)return;setLoading(true);setError('');try{const data=await client.list(context);setItems(data.items);setUnreadCount(data.unreadCount);}catch(e){setError(e instanceof Error?e.message:'تعذر تحميل الإشعارات.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[context.token,context.companyId,context.branchId]);
 const visible=useMemo(()=>items.filter(item=>filter==='all'||filter==='unread'?!item.readAt:Boolean(item.readAt)),[items,filter]);
 async function read(item:NotificationItem){if(item.readAt)return;try{await client.read(context,item.id);await load();}catch(e){setError(e instanceof Error?e.message:'تعذر تحديث الإشعار.');}}
 async function readAll(){try{const result=await client.readAll(context);setNotice(result.updated?'تم تحديد '+result.updated+' إشعار كمقروء.':'لا توجد إشعارات غير مقروءة.');await load();}catch(e){setError(e instanceof Error?e.message:'تعذر تحديث الإشعارات.');}}
 return <section dir="rtl" className="ui-page-stack" aria-label="مركز الإشعارات">
  <Card title="مركز الإشعارات"><p>كل التنبيهات الخاصة بالشركة الحالية والإشعارات العامة للمنصة في مكان واحد.</p><ActionBar><Button type="button" variant="secondary" onClick={()=>void load()} disabled={loading}>تحديث</Button><Button type="button" onClick={()=>void readAll()} disabled={loading||unreadCount===0}>تحديد الكل كمقروء</Button></ActionBar></Card>
  <div className="ui-metric-grid"><MetricCard label="إجمالي الإشعارات" value={items.length}/><MetricCard label="غير مقروء" value={unreadCount} tone={unreadCount?'warning':'success'}/><MetricCard label="مقروء" value={items.length-unreadCount}/></div>
  <Tabs tabs={[{id:'all',label:'الكل'},{id:'unread',label:'غير مقروء'},{id:'read',label:'مقروء'}]} active={filter} onChange={id=>setFilter(id as Filter)}/>
  {notice?<Toast tone="success">{notice}</Toast>:null}{error?<ErrorState message={error}/>:null}
  {loading?<LoadingState/>:!visible.length?<EmptyState title="لا توجد إشعارات في هذا التصنيف"/>:<Card title="الإشعارات"><DataGrid columns={['الحالة','العنوان','الرسالة','النوع','الوقت','إجراء']}>{visible.map(item=>{const target=route(item);return <tr key={item.id}><td><Badge tone={severity(item)}>{item.readAt?'مقروء':'جديد'}</Badge></td><td>{text(item.payload,'title','إشعار')}</td><td>{text(item.payload,'message','—')}</td><td>{item.type}</td><td>{new Date(item.createdAt).toLocaleString('ar-EG')}</td><td><ActionBar>{!item.readAt?<Button type="button" variant="secondary" onClick={()=>void read(item)}>تحديد كمقروء</Button>:null}{target?<Button type="button" onClick={()=>{window.location.href=target}}>فتح</Button>:null}</ActionBar></td></tr>})}</DataGrid></Card>}
 </section>;
}
