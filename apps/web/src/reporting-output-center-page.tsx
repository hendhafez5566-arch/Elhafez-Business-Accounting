import{useEffect,useMemo,useState}from'react';
import{HttpReportingCenterClient,type ReportingCenterClient,type ReportingCenterData}from'./reporting-center-client.js';
import{ActionBar,Badge,Button,Card,DataGrid,EmptyState,ErrorState,LoadingState,MetricCard,Toast}from'./ui.js';

type DueRow={key:string;kind:'CUSTOMER'|'SUPPLIER';partyId:string;document:string;dueDate:string;days:number;currency:string;outstanding:string;status:'OVERDUE'|'DUE_SOON'};
const empty:ReportingCenterData={management:{generatedAt:'',totals:{attention:0,critical:0,high:0},domains:[],summary:{crmSales:{customers:0,agents:0,travelers:0,overdueFollowups:0,leadStages:{},quotationStatuses:{},quotationValueByCurrency:[]},suppliers:{total:0,openDisputes:0,activeHolds:0},hajjUmrah:{activePrograms:0,readinessItems:0,criticalReadinessItems:0},finance:{overduePositions:0,overdueByCurrency:[]}},items:[]},accounting:{fiscalYears:[],periods:[],accounts:[],journals:[],invoices:[],treasuries:[],vouchers:[],taxPolicies:[],approvalPolicies:[],approvalRequests:[],controlIssues:[],reports:{trialBalance:{rows:[]},incomeStatement:{rows:[]},balanceSheet:{rows:[]},treasury:{totals:[]},tax:{totals:[],facts:[]}}},financialHistory:{reconciliationRuns:[],closeReadinessRuns:[],auditEntries:[]},savedReports:[],schedules:[]};
function positive(value:string){const text=value.trim();return !text.startsWith('-')&&/[1-9]/.test(text)}
function dueRows(data:ReportingCenterData['accounting'],today=new Date()):DueRow[]{const current=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate());return data.invoices.flatMap(row=>{if(row.status!=='POSTED'||!row.dueDate||!positive(row.outstanding)||(row.type!=='CUSTOMER'&&row.type!=='SUPPLIER'))return[];const due=new Date(row.dueDate+'T00:00:00Z').getTime();if(Number.isNaN(due))return[];const days=Math.floor((current-due)/86400000);if(days< -7)return[];return[{key:row.id,kind:row.type,partyId:row.partyId,document:row.externalInvoiceNumber??row.number,dueDate:row.dueDate,days,currency:row.currency,outstanding:row.outstanding,status:days>0?'OVERDUE' as const:'DUE_SOON' as const}]});}
const outputs=[
 {label:'عروض الأسعار',detail:'طباعة ومراجعة عروض الأسعار من المالك الأصلي.',path:'/crm/quotations'},
 {label:'تأكيدات وحجوزات السياحة',detail:'الحجوزات والتأكيدات والمخرجات السياحية.',path:'/tourism/bookings'},
 {label:'حجوزات الحج والعمرة',detail:'تأكيدات وحالة حجوزات الحج والعمرة.',path:'/hajj-umrah/bookings'},
 {label:'Rooming List',detail:'قوائم التسكين والغرف من وحدة التسكين.',path:'/hajj-umrah/rooming'},
 {label:'Manifest / Flight Report',detail:'قوائم المسافرين ومخرجات التذاكر والطيران.',path:'/hajj-umrah/ticketing'},
 {label:'Transport Order',detail:'أوامر النقل والتفويج.',path:'/hajj-umrah/transport'},
 {label:'Supplier Dues / Statements',detail:'مستحقات الموردين وكشف المورد من مركز التقارير.',path:'/management/reports'},
 {label:'Customer Statements',detail:'كشف حساب العميل والحركات والأرصدة المفتوحة.',path:'/management/reports'},
] as const;

export function ReportingOutputCenterPage({client}:{client?:ReportingCenterClient}={}){
 const api=useMemo(()=>client??new HttpReportingCenterClient(),[client]),[data,setData]=useState<ReportingCenterData>(empty),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){setLoading(true);setError('');try{setData(await api.load());}catch(e){setError(e instanceof Error?e.message:'تعذر تحميل مركز المخرجات والاستحقاقات.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[api]);
 async function run(id:string){setLoading(true);setError('');setNotice('');try{await api.runScheduleNow(id);setNotice('تم تشغيل التقرير وإرساله إلى مركز الإشعارات داخل النظام.');}catch(e){setError(e instanceof Error?e.message:'تعذر تشغيل التقرير.');}finally{setLoading(false);}}
 const due=useMemo(()=>dueRows(data.accounting),[data.accounting]),overdue=due.filter(row=>row.status==='OVERDUE'),soon=due.filter(row=>row.status==='DUE_SOON');
 return <section dir="rtl" className="ui-dashboard" aria-label="مركز المخرجات والاستحقاقات">
  <Card title="مركز المخرجات والاستحقاقات"><p>بوابة تشغيل موحدة للمخرجات والاستحقاقات والتنبيهات، مع إبقاء إنشاء المستند والحقيقة المالية داخل المالك الأصلي لكل وحدة.</p><ActionBar><Button type="button" variant="secondary" onClick={()=>void load()} disabled={loading}>تحديث</Button><Button type="button" variant="secondary" onClick={()=>{window.location.href='/management/exceptions'}}>مركز العمل والاستثناءات</Button><Button type="button" variant="secondary" onClick={()=>{window.location.href='/notifications'}}>مركز الإشعارات</Button></ActionBar></Card>
  {notice?<Toast tone="success">{notice}</Toast>:null}{error?<ErrorState message={error}/>:null}{loading?<LoadingState/>:null}
  <div className="ui-metric-grid" aria-label="مؤشرات المخرجات"><MetricCard label="استحقاقات متأخرة" value={overdue.length} tone={overdue.length?'warning':'success'}/><MetricCard label="مستحقة خلال 7 أيام" value={soon.length}/><MetricCard label="استثناءات تشغيلية" value={data.management.totals.attention} tone={data.management.totals.attention?'warning':'success'}/><MetricCard label="استثناءات حرجة" value={data.management.totals.critical} tone={data.management.totals.critical?'warning':'success'}/></div>
  <section className="ui-dashboard-grid" aria-label="المخرجات والاستحقاقات">
   <Card title="المخرجات المركزية"><DataGrid columns={['المخرج','الاستخدام','فتح المالك']}>{outputs.map(row=><tr key={row.label}><td><strong>{row.label}</strong></td><td>{row.detail}</td><td><Button type="button" variant="secondary" onClick={()=>{window.location.href=row.path}}>فتح</Button></td></tr>)}</DataGrid></Card>
   <Card title="استحقاقات العملاء والموردين">{!due.length?<EmptyState title="لا توجد استحقاقات متأخرة أو مستحقة خلال 7 أيام"/>:<DataGrid columns={['النوع','الطرف','المستند','تاريخ الاستحقاق','الحالة','الأيام','العملة','المتبقي']}>{due.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).map(row=><tr key={row.key}><td>{row.kind==='CUSTOMER'?'عميل':'مورد'}</td><td>{row.partyId}</td><td>{row.document}</td><td>{row.dueDate}</td><td><Badge tone={row.status==='OVERDUE'?'warning':'info'}>{row.status==='OVERDUE'?'متأخر':'قريب الاستحقاق'}</Badge></td><td>{row.days>0?row.days:Math.abs(row.days)+' متبقي'}</td><td>{row.currency}</td><td><strong>{row.outstanding}</strong></td></tr>)}</DataGrid>}</Card>
  </section>
  <section className="ui-dashboard-grid" aria-label="التقارير والتنبيهات">
   <Card title="تشغيل التقارير المجدولة">{!data.schedules.length?<EmptyState title="لا توجد جداول تقارير"/>:<DataGrid columns={['التقرير','القناة','الحالة','تشغيل']}>{data.schedules.map(row=>{const report=data.savedReports.find(saved=>saved.id===row.savedReportId);return <tr key={row.id}><td>{report?.name??row.savedReportId}</td><td>{row.channel==='IN_APP'?'داخل النظام':'بريد إلكتروني'}</td><td><Badge tone={row.enabled?'success':'warning'}>{row.enabled?'نشط':'متوقف'}</Badge></td><td>{row.channel==='IN_APP'?<Button type="button" variant="secondary" disabled={!row.enabled||loading} onClick={()=>void run(row.id)}>تشغيل الآن</Button>:<span>يتطلب تكامل بريد إلكتروني</span>}</td></tr>})}</DataGrid>}</Card>
   <Card title="التنبيهات التشغيلية">{!data.management.items.length?<EmptyState title="لا توجد تنبيهات تشغيلية"/>:<DataGrid columns={['المجال','العنوان','التفاصيل','الأولوية','فتح']}>{data.management.items.map(row=><tr key={row.sourceKey}><td>{row.sourceDomain}</td><td><strong>{row.title}</strong></td><td>{row.summary}</td><td><Badge tone={row.severity==='CRITICAL'||row.severity==='HIGH'?'warning':'info'}>{row.severity}</Badge></td><td><Button type="button" variant="secondary" onClick={()=>{window.location.href=row.drillDownPath}}>فتح</Button></td></tr>)}</DataGrid>}</Card>
  </section>
 </section>;
}
