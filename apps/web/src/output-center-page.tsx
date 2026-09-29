import{Card,Button,ActionBar,DataGrid,Badge,EmptyState}from'./ui.js';
import{managementControlApi,type ManagementOverview}from'./management-control-client.js';
import{useEffect,useState}from'react';

type OutputLink={title:string;description:string;route:string;kind:string};
const outputs:readonly OutputLink[]=[
 {title:'عروض الأسعار',description:'طباعة ومراجعة عروض الأسعار من مالك CRM.',route:'/crm/quotations',kind:'CRM'},
 {title:'كشف حساب عميل / مورد',description:'فتح مركز التقارير لكشوف الحساب المحفوظة والقابلة للطباعة والتصدير.',route:'/management/reports',kind:'FINANCE'},
 {title:'تأكيدات الحجوزات السياحية',description:'فتح الحجوزات السياحية وإخراج التأكيدات من مالك الحجز.',route:'/tourism/bookings',kind:'TOURISM'},
 {title:'ملخصات البرامج',description:'فتح البرامج السياحية أو برامج الحج والعمرة من مالك البرنامج.',route:'/tourism/programs',kind:'PROGRAM'},
 {title:'Rooming List',description:'تسكين الغرف وقوائم التسكين من مالك Hajj/Umrah Rooming.',route:'/hajj-umrah/rooming',kind:'HAJJ_UMRAH'},
 {title:'Manifest / Flight Outputs',description:'التذاكر والطيران والـmanifest من مالك Ticketing.',route:'/hajj-umrah/ticketing',kind:'HAJJ_UMRAH'},
 {title:'Transport Orders',description:'أوامر النقل والتفويج من مالك Transport Operations.',route:'/hajj-umrah/transport',kind:'HAJJ_UMRAH'},
 {title:'Hotel / Service Vouchers',description:'قسائم الخدمات من مالك السياحة والخدمات.',route:'/tourism/services',kind:'TOURISM'},
 {title:'Supplier Dues / Procurement',description:'الموردون وأوامر الشراء والاستحقاقات من مالك المشتريات.',route:'/procurement/purchase-orders',kind:'PROCUREMENT'},
];

export function OutputCenterPage(){
 const[data,setData]=useState<ManagementOverview|null>(null),[error,setError]=useState('');
 useEffect(()=>{managementControlApi.overview().then(setData).catch(e=>setError(e instanceof Error?e.message:'تعذر تحميل التنبيهات.'));},[]);
 const attention=data?.items??[];
 return <section dir="rtl" className="ui-page-stack" aria-label="مركز المخرجات">
  <Card title="مركز المخرجات"><p>نقطة وصول مركزية للمخرجات والطباعة بدون إنشاء محرك طباعة موازٍ؛ كل مستند يظل مملوكًا للموديول الأصلي.</p>{error?<p>{error}</p>:null}</Card>
  <Card title="المخرجات المتاحة"><DataGrid columns={['المخرج','المالك','الوصف','فتح']}>{outputs.map(row=><tr key={row.title}><td>{row.title}</td><td><Badge tone="info">{row.kind}</Badge></td><td>{row.description}</td><td><Button type="button" onClick={()=>{window.location.href=row.route}}>فتح</Button></td></tr>)}</DataGrid></Card>
  <Card title="الاستحقاقات والتنبيهات التشغيلية">{!attention.length?<EmptyState title="لا توجد استثناءات تشغيلية حالية"/>:<DataGrid columns={['المجال','العنوان','الملخص','الأولوية','الحالة','فتح']}>{attention.map(row=><tr key={row.sourceKey}><td>{row.sourceDomain}</td><td>{row.title}</td><td>{row.summary}</td><td><Badge tone={row.severity==='CRITICAL'||row.severity==='HIGH'?'warning':'info'}>{row.severity}</Badge></td><td>{row.status}</td><td><ActionBar><Button type="button" variant="secondary" onClick={()=>{window.location.href=row.drillDownPath}}>فتح المصدر</Button></ActionBar></td></tr>)}</DataGrid>}</Card>
 </section>;
}
