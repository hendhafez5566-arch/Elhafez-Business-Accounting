import{type FormEvent,useEffect,useState}from'react';
import{crmGet}from'./crm-core-client.js';
import{ActionBar,Badge,Button,Card,DataGrid,EmptyState,ErrorState,FormField,Input,LoadingState}from'./ui.js';

type SearchItem={kind:string;id:string;title:string;subtitle:string;route:string};
type QuickAction={permission:string;label:string;route:string;action:string};
const labels:Record<string,string>={CUSTOMER:'عميل',LEAD:'عميل محتمل',QUOTATION:'عرض سعر',SUPPLIER:'مورد',TRAVELER:'مسافر',TOURISM_PROGRAM:'برنامج سياحي',HAJJ_UMRAH_PROGRAM:'برنامج حج/عمرة'};
function message(error:unknown){return error instanceof Error?error.message:'تعذر تنفيذ البحث.';}

export function GlobalSearchPage(){
 const[q,setQ]=useState(''),[rows,setRows]=useState<SearchItem[]>([]),[actions,setActions]=useState<QuickAction[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{crmGet<QuickAction[]>('/search/quick-actions').then(setActions).catch(()=>setActions([]));},[]);
 async function search(event?:FormEvent){event?.preventDefault();const value=q.trim();if(value.length<2){setRows([]);return;}setLoading(true);setError('');try{setRows(await crmGet<SearchItem[]>('/search?q='+encodeURIComponent(value)));}catch(e){setError(message(e));}finally{setLoading(false);}}
 return <section dir="rtl" className="ui-page-stack" aria-label="البحث الشامل">
  <Card title="البحث الشامل"><form onSubmit={search}><FormField label="ابحث في بيانات النظام" hint="ابحث بالاسم أو الرقم أو الكود في العملاء والموردين والمسافرين وعروض الأسعار والبرامج."><Input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="اكتب حرفين على الأقل…"/></FormField><Button type="submit" disabled={loading||q.trim().length<2}>بحث</Button></form></Card>
  {actions.length?<Card title="إجراءات سريعة"><ActionBar>{actions.map(action=><Button key={action.action} type="button" variant="secondary" onClick={()=>{window.location.href=action.route;}}>{action.label}</Button>)}</ActionBar></Card>:null}
  {loading?<LoadingState label="جارٍ البحث…"/>:error?<ErrorState message={error}/>:q.trim().length>=2&&!rows.length?<EmptyState title="لا توجد نتائج مطابقة"/>:rows.length?<Card title="النتائج"><DataGrid columns={['النوع','النتيجة','التفاصيل','فتح']}>{rows.map(row=><tr key={row.kind+':'+row.id}><td><Badge tone="info">{labels[row.kind]??row.kind}</Badge></td><td>{row.title}</td><td>{row.subtitle||'—'}</td><td><Button type="button" variant="secondary" onClick={()=>{window.location.href=row.route;}}>فتح</Button></td></tr>)}</DataGrid></Card>:null}
 </section>;
}
