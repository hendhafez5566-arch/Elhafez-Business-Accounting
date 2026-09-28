import{useEffect,useState}from'react';
import{accountingApi,type AccountingOverview}from'./accounting-client.js';
import{crmGet}from'./crm-core-client.js';
import{Badge,Button,Card,DataGrid,ErrorState,LoadingState,MetricCard}from'./ui.js';

type Diagnostics={database:'AVAILABLE'|'UNAVAILABLE';backupProvider:'AVAILABLE'|'UNAVAILABLE';schemaCompatibility:'CURRENT'|'INCOMPLETE'|'UNAVAILABLE';runtimeVersion:string;restoreReady?:boolean;maintenance?:boolean};
type ReadinessData={diagnostics:Diagnostics;accounting:AccountingOverview;customers:number;suppliers:number;programs:number;users:number};
type Check={label:string;ok:boolean;detail:string;href:string};
function count(value:unknown){return Array.isArray(value)?value.length:0;}
function go(href:string){window.location.href=href;}

export function CommercialReadinessPage({mode='readiness'}:{readonly mode?:'readiness'|'guide'}={}){
 const[data,setData]=useState<ReadinessData|null>(null),[error,setError]=useState('');
 async function load(){try{const[d,a,customers,suppliers,programs,users]=await Promise.all([
  crmGet<Diagnostics>('/system-administration/operations/diagnostics'),
  accountingApi.overview(),
  crmGet<unknown[]>('/crm/customers'),
  crmGet<unknown[]>('/suppliers'),
  crmGet<unknown[]>('/hajj-umrah/programs'),
  crmGet<unknown[]>('/system-administration/users'),
 ]);setData({diagnostics:d,accounting:a,customers:count(customers),suppliers:count(suppliers),programs:count(programs),users:count(users)});setError('');}catch(value){setError(value instanceof Error?value.message:'تعذر فحص الجاهزية.');}}
 useEffect(()=>{void load();},[]);
 if(error)return <ErrorState message={error}/>;
 if(!data)return <LoadingState label="جارٍ فحص جاهزية النظام…"/>;
 const checks:Check[]=[
  {label:'قاعدة البيانات',ok:data.diagnostics.database==='AVAILABLE',detail:data.diagnostics.database==='AVAILABLE'?'متاحة':'غير متاحة',href:'/system-administration/diagnostics'},
  {label:'توافق المخطط',ok:data.diagnostics.schemaCompatibility==='CURRENT',detail:data.diagnostics.schemaCompatibility,href:'/system-administration/diagnostics'},
  {label:'دليل الحسابات',ok:data.accounting.accounts.some(item=>item.active&&item.postable),detail:data.accounting.accounts.length+' حساب',href:'/accounting/chart'},
  {label:'الفترات المالية',ok:data.accounting.fiscalYears.length>0&&data.accounting.periods.length>0,detail:data.accounting.periods.length+' فترة',href:'/accounting/periods'},
  {label:'خزنة أو بنك',ok:data.accounting.treasuries.some(item=>item.active),detail:data.accounting.treasuries.filter(item=>item.active).length+' نشط',href:'/accounting/treasury'},
  {label:'العملاء',ok:data.customers>0,detail:data.customers+' سجل',href:'/crm/customers'},
  {label:'الموردون',ok:data.suppliers>0,detail:data.suppliers+' سجل',href:'/procurement/suppliers'},
  {label:'المستخدمون',ok:data.users>0,detail:data.users+' مستخدم',href:'/system-administration/users'},
  {label:'برامج الحج والعمرة',ok:data.programs>0,detail:data.programs+' برنامج',href:'/hajj-umrah/programs'},
 ];
 const ready=checks.filter(item=>item.ok).length,score=Math.round((ready/checks.length)*100);
 if(mode==='guide')return <section dir="rtl" className="ui-page-stack" aria-label="دليل البدء السريع"><Card title="دليل البدء السريع"><p>مسار واحد لتجهيز شركة جديدة بدون الحاجة لمعرفة المعرّفات الداخلية أو ترتيب الموديولات.</p></Card><div className="ui-grid-md">
  {[
   ['1 — بيانات الشركة والفروع','راجع اسم الشركة والفروع والوصول وإعدادات التشغيل.','/system-administration/company-settings'],
   ['2 — المستخدمون والصلاحيات','أنشئ المستخدمين وحدد أقل صلاحيات يحتاجها كل موظف.','/system-administration/users'],
   ['3 — الحسابات والخزن','جهز دليل الحسابات والفترات وخزنة أو بنكًا قبل أول حركة.','/accounting'],
   ['4 — العملاء والموردون','أدخل الأطراف الأساسية أو استخدم الاستيراد المنظم.','/crm/customers'],
   ['5 — المشتريات والخدمات','راجع الموردين والتعاقدات والتوريد قبل التشغيل.','/procurement/suppliers'],
   ['6 — الحج والعمرة والسياحة','أنشئ برنامجًا تجريبيًا، مكوناته، المسافرين ثم أول حجز.','/hajj-umrah/programs'],
   ['7 — دورة مالية تجريبية','أنشئ مستندًا ماليًا وراجع القيود والخزينة والتقارير.','/accounting/reports'],
   ['8 — التشخيص والنسخ','راجع التشخيص؛ النسخ والاستعادة على مستوى المنصة من مركز المالك.','/system-administration/diagnostics'],
  ].map(([title,detail,href])=><Card key={title} title={title}><p>{detail}</p><Button type="button" onClick={()=>go(href)}>فتح</Button></Card>)}
 </div><Card title="فحص الجاهزية"><Button type="button" onClick={()=>go('/system/readiness')}>تشغيل فحص الجاهزية الآن</Button></Card></section>;
 return <section dir="rtl" className="ui-page-stack" aria-label="جاهزية البيع والتشغيل"><Card title="جاهزية البيع والتشغيل"><div className="ui-metric-grid"><MetricCard label="نسبة الجاهزية" value={score+'%'} tone={score===100?'success':'warning'}/><MetricCard label="عناصر مكتملة" value={ready+' / '+checks.length}/><MetricCard label="إصدار التشغيل" value={data.diagnostics.runtimeVersion}/></div><p>هذا الفحص يقرأ المصادر الأصلية فقط ولا ينشئ حقائق موازية أو بيانات شكلية.</p><Button type="button" onClick={()=>void load()}>إعادة الفحص</Button></Card><DataGrid columns={['العنصر','الحالة','التفاصيل','الإجراء']}>{checks.map(item=><tr key={item.label}><td>{item.label}</td><td><Badge tone={item.ok?'success':'warning'}>{item.ok?'جاهز':'يحتاج استكمال'}</Badge></td><td>{item.detail}</td><td><Button type="button" onClick={()=>go(item.href)}>{item.ok?'مراجعة':'استكمال'}</Button></td></tr>)}</DataGrid><Card title="الخطوة التالية"><Button type="button" onClick={()=>go('/system/quick-start')}>فتح دليل البدء السريع</Button></Card></section>;
}

export function PeriodArchivePage(){
 const[data,setData]=useState<AccountingOverview|null>(null),[error,setError]=useState('');
 useEffect(()=>{accountingApi.overview().then(setData).catch(value=>setError(value instanceof Error?value.message:'تعذر تحميل الأرشيف المالي.'));},[]);
 if(error)return <ErrorState message={error}/>;
 if(!data)return <LoadingState label="جارٍ تحميل الأرشيف المالي…"/>;
 const closed=data.periods.filter(item=>item.status==='CLOSED');
 return <section dir="rtl" className="ui-page-stack" aria-label="الأرشفة المالية"><Card title="الأرشفة الذكية للفترات"><p>في البنية الجديدة لا يتم نسخ البيانات إلى أرشيف موازٍ. إغلاق الفترة هو الحقيقة المحاسبية، والنسخ الاحتياطي الكامل مسؤولية مركز تحكم مالك المنصة.</p><div className="ui-metric-grid"><MetricCard label="الفترات المغلقة" value={closed.length}/><MetricCard label="إجمالي الفترات" value={data.periods.length}/></div></Card>{closed.length?<DataGrid columns={['من','إلى','الحالة']}>{closed.map(item=><tr key={item.id}><td>{item.startDate}</td><td>{item.endDate}</td><td><Badge tone="neutral">مغلقة</Badge></td></tr>)}</DataGrid>:<Card title="لا توجد فترات مغلقة"><p>أغلق الفترة من شاشة الفترات المالية بعد المراجعة المحاسبية.</p></Card>}<Card title="الإجراءات الآمنة"><Button type="button" onClick={()=>go('/accounting/periods')}>إدارة الفترات</Button><Button type="button" onClick={()=>go('/system-administration/diagnostics')}>فحص صحة النظام</Button></Card></section>;
}
