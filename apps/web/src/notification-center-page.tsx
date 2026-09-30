import{useEffect,useMemo,useState}from'react';
import{ActionBar,Badge,Button,Card,DataGrid,EmptyState,ErrorState,LoadingState,MasterDetailWorkspace,MetricCard,Toast,WorkspaceNavigation}from'./ui.js';
import{HttpNotificationCenterClient,type NotificationCenterClient,type NotificationItem}from'./notification-center-client.js';
import{tenantApiContext}from'./tenant-session.js';

type Filter='all'|'unread'|'read';
const filters=[{id:'all',label:'كل الإشعارات',description:'كل ما وصل للشركة الحالية'},{id:'unread',label:'غير مقروء',description:'الإشعارات التي تحتاج مراجعة'},{id:'read',label:'مقروء',description:'الإشعارات التي تمت مراجعتها'}] as const;
function text(payload:Readonly<Record<string,unknown>>,key:string,fallback:string){const value=payload[key];return typeof value==='string'&&value.trim()?value.trim():fallback;}
function severity(item:NotificationItem){const value=text(item.payload,'severity','INFO').toUpperCase();return value==='CRITICAL'||value==='HIGH'?'warning':item.readAt?'neutral':'info' as const;}
function route(item:NotificationItem){const value=item.payload.route;return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')?value:null;}

export function NotificationCenterPage({client=new HttpNotificationCenterClient()}:{client?:NotificationCenterClient}={}){
 const context=tenantApiContext(),[items,setItems]=useState<readonly NotificationItem[]>([]),[unreadCount,setUnreadCount]=useState(0),[filter,setFilter]=useState<Filter>('all'),[selected,setSelected]=useState<NotificationItem|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){if(!context.token)return;setLoading(true);setError('');try{const data=await client.list(context);setItems(data.items);setUnreadCount(data.unreadCount);setSelected(current=>current?data.items.find(item=>item.id===current.id)??null:null);}catch(e){setError(e instanceof Error?e.message:'تعذر تحميل الإشعارات.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[context.token,context.companyId,context.branchId]);
 const visible=useMemo(()=>items.filter(item=>filter==='all'||(filter==='unread'?!item.readAt:Boolean(item.readAt))),[items,filter]);
 async function read(item:NotificationItem){if(item.readAt)return;try{await client.read(context,item.id);await load();}catch(e){setError(e instanceof Error?e.message:'تعذر تحديث الإشعار.');}}
 async function readAll(){try{const result=await client.readAll(context);setNotice(result.updated?'تم تحديد '+result.updated+' إشعار كمقروء.':'لا توجد إشعارات غير مقروءة.');await load();}catch(e){setError(e instanceof Error?e.message:'تعذر تحديث الإشعارات.');}}
 const list=<section aria-label="قائمة الإشعارات"><div className="ui-inline"><div><h3>{filters.find(item=>item.id===filter)?.label}</h3><p className="ui-page-intro">اختر إشعارًا لعرض التفاصيل وفتح المصدر التشغيلي.</p></div><Badge tone={unreadCount?'warning':'success'}>{unreadCount} غير مقروء</Badge></div>{!visible.length?<EmptyState title="لا توجد إشعارات في هذا التصنيف"/>:<DataGrid columns={['الحالة','العنوان','النوع','الوقت','إجراء']}>{visible.map(item=><tr key={item.id}><td><Badge tone={severity(item)}>{item.readAt?'مقروء':'جديد'}</Badge></td><td><strong>{text(item.payload,'title','إشعار')}</strong><small className="ui-block">{text(item.payload,'message','—')}</small></td><td>{item.type}</td><td>{new Date(item.createdAt).toLocaleString('ar-EG')}</td><td><ActionBar><Button type="button" variant="secondary" onClick={()=>setSelected(item)}>عرض</Button>{!item.readAt?<Button type="button" variant="secondary" onClick={()=>void read(item)}>كمقروء</Button>:null}</ActionBar></td></tr>)}</DataGrid>}</section>;
 const detail=selected?<section aria-label="تفاصيل الإشعار"><p><Badge tone={severity(selected)}>{selected.readAt?'مقروء':'جديد'}</Badge></p><h3>{text(selected.payload,'title','إشعار')}</h3><p>{text(selected.payload,'message','لا توجد تفاصيل إضافية.')}</p><p><strong>النوع:</strong> {selected.type}</p><p><strong>الوقت:</strong> {new Date(selected.createdAt).toLocaleString('ar-EG')}</p><ActionBar>{!selected.readAt?<Button type="button" variant="secondary" onClick={()=>void read(selected)}>تحديد كمقروء</Button>:null}{route(selected)?<Button type="button" onClick={()=>{window.location.href=route(selected)!}}>فتح المصدر</Button>:null}</ActionBar></section>:<EmptyState title="اختر إشعارًا">ستظهر هنا تفاصيل الإشعار وإجراءات الانتقال للمصدر.</EmptyState>;
 return <section dir="rtl" className="ui-dashboard" aria-label="مركز الإشعارات">
  <Card title="مركز الإشعارات"><p>صندوق موحد لتنبيهات الشركة الحالية والإشعارات العامة للمنصة، مع فتح المصدر التشغيلي مباشرة من نفس مساحة العمل.</p><ActionBar><Button type="button" variant="secondary" onClick={()=>void load()} disabled={loading}>تحديث</Button><Button type="button" onClick={()=>void readAll()} disabled={loading||unreadCount===0}>تحديد الكل كمقروء</Button></ActionBar></Card>
  <div className="ui-metric-grid" aria-label="مؤشرات الإشعارات"><MetricCard label="إجمالي الإشعارات" value={items.length}/><MetricCard label="غير مقروء" value={unreadCount} tone={unreadCount?'warning':'success'}/><MetricCard label="مقروء" value={items.length-unreadCount}/></div>
  {notice?<Toast tone="success">{notice}</Toast>:null}{error?<ErrorState message={error}/>:null}{loading?<LoadingState/>:null}
  <Card title="تصفية صندوق الإشعارات"><WorkspaceNavigation items={filters} active={filter} onChange={id=>{setFilter(id as Filter);setSelected(null);}} ariaLabel="تصفية الإشعارات"/></Card>
  <MasterDetailWorkspace master={list} detail={detail}/>
 </section>;
}
