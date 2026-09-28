import {useEffect,useMemo,useState} from 'react';
import {Badge,Button,Card,DataGrid,EmptyState,EntityPicker,ErrorState,FormField,LoadingState} from './ui.js';
import {crmGet} from './crm-core-client.js';
import {businessReferenceApi,agentOption,customerOption,type AgentReference,type CustomerReference} from './business-reference-client.js';

type Party={id:string;displayName:string;phone:string|null;email:string|null;whatsappNumber:string|null};
type CustomerView={customer:{id:string;number:string;status:string;assignedAgentId:string|null};party:Party};
type AgentView={agent:{id:string;number:string;status:string;commission:{kind:string;value:string;currency:string|null}};party:Party};
type Lead={id:string;number:string;displayName:string;status:string;convertedCustomerId:string|null;referralAgentId:string|null};
type Followup={id:string;leadId:string;interactionType:string;scheduledAt:string;status:string;outcome:string|null};
type Quote={id:string;number:string;status:string;approvalStatus:string;currency:string;customerId:string|null;sourceLeadId:string|null;customerSnapshot:{displayName:string};currentRevisionId:string;acceptedRevisionId:string|null;billingInvoiceId:string|null;revisions:Array<{id:string;validityDate:string;total:string}>};
type Traveler={id:string;fullName:string;dateOfBirth:string|null;gender:string|null;nationality:string|null;partyId:string|null;customerId:string|null;status:'ACTIVE'|'ARCHIVED'};
type Customer360={customer:CustomerView;leads:Lead[];followups:Followup[];quotations:Quote[];travelers:Traveler[];quotationLinkedFinancialPositions:Array<{invoiceId:string;currency:string;documentTotal:string;outstanding:string;status:string}>;quotationLinkedFinancialSummaryByCurrency:Array<{currency:string;documentTotal:string;outstanding:string}>};
type Agent360={agent:AgentView;customers:CustomerView[];leads:Lead[];quotations:Quote[]};
const errorMessage=(e:unknown)=>e instanceof Error?e.message:'حدث خطأ غير متوقع';
function queryParam(name:string){return typeof window==='undefined'?'':new URLSearchParams(window.location.search).get(name)??'';}

export function Customer360Page(){
 const[id,setId]=useState(()=>queryParam('customerId')),[choices,setChoices]=useState<CustomerReference[]>([]),[data,setData]=useState<Customer360|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{businessReferenceApi.customers().then(setChoices).catch(e=>setError(errorMessage(e)));},[]);
 async function load(target=id){if(!target.trim())return;setLoading(true);try{setData(await crmGet<Customer360>(`/crm/insights/customers/${encodeURIComponent(target.trim())}`));setError('');}catch(e){setError(errorMessage(e));}finally{setLoading(false);}}
 useEffect(()=>{if(id)void load(id);},[]);
 const leadNames=useMemo(()=>new Map((data?.leads??[]).map(v=>[v.id,`${v.number} — ${v.displayName}`])),[data?.leads]);
 return <section aria-label="ملف العميل 360 درجة" className="ui-page-stack">
  <Card title="ملف العميل 360°"><FormField label="العميل"><EntityPicker value={id} onChange={value=>{setId(value);if(value)void load(value);}} options={choices.map(customerOption)} placeholder="اختر العميل"/></FormField><Button disabled={!id||loading} onClick={()=>void load()}>تحديث الملف الموحد</Button></Card>
  {loading?<LoadingState/>:error?<ErrorState message={error}/>:data?<>
   <Card title={`${data.customer.customer.number} — ${data.customer.party.displayName}`}><p>{data.customer.party.phone??'—'} | {data.customer.party.email??'—'} | واتساب: {data.customer.party.whatsappNumber??'—'} | الحالة: <Badge>{data.customer.customer.status}</Badge></p></Card>
   <Card title="ملخص العلاقات"><p>العملاء المحتملون: {data.leads.length} | المتابعات: {data.followups.length} | عروض الأسعار: {data.quotations.length} | المسافرون: {data.travelers.length}</p></Card>
   <Card title="المسافرون المرتبطون">{!data.travelers.length?<EmptyState/>:<DataGrid columns={['الاسم','الجنسية','الحالة']}>{data.travelers.map(t=><tr key={t.id}><td>{t.fullName}</td><td>{t.nationality??'—'}</td><td>{t.status}</td></tr>)}</DataGrid>}</Card>
   <Card title="المتابعات">{!data.followups.length?<EmptyState/>:<DataGrid columns={['العميل المحتمل','نوع التواصل','الموعد','الحالة','النتيجة']}>{data.followups.map(v=><tr key={v.id}><td>{leadNames.get(v.leadId)??'عميل محتمل'}</td><td>{v.interactionType}</td><td>{new Date(v.scheduledAt).toLocaleString('ar-EG')}</td><td>{v.status}</td><td>{v.outcome??'—'}</td></tr>)}</DataGrid>}</Card>
   <Card title="المراكز المالية المرتبطة بعروض الأسعار">{!data.quotationLinkedFinancialSummaryByCurrency.length?<EmptyState title="لا توجد فواتير محولة مرتبطة بعروض الأسعار"/>:<DataGrid columns={['العملة','إجمالي المستندات','المتبقي']}>{data.quotationLinkedFinancialSummaryByCurrency.map(v=><tr key={v.currency}><td>{v.currency}</td><td>{v.documentTotal}</td><td>{v.outstanding}</td></tr>)}</DataGrid>}</Card>
   <Card title="عروض الأسعار">{!data.quotations.length?<EmptyState/>:<DataGrid columns={['الرقم','الحالة','العملة','الفاتورة']}>{data.quotations.map(q=><tr key={q.id}><td>{q.number}</td><td>{q.status}</td><td>{q.currency}</td><td>{q.billingInvoiceId?'تم التحويل':'—'}</td></tr>)}</DataGrid>}</Card>
  </>:<EmptyState title="اختر عميلًا لعرض ملفه الموحد"/>}
 </section>;
}

export function Agent360Page(){
 const[id,setId]=useState(()=>queryParam('agentId')),[choices,setChoices]=useState<AgentReference[]>([]),[data,setData]=useState<Agent360|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{businessReferenceApi.agents().then(setChoices).catch(e=>setError(errorMessage(e)));},[]);
 async function load(target=id){if(!target.trim())return;setLoading(true);try{setData(await crmGet<Agent360>(`/crm/insights/agents/${encodeURIComponent(target.trim())}`));setError('');}catch(e){setError(errorMessage(e));}finally{setLoading(false);}}
 useEffect(()=>{if(id)void load(id);},[]);
 return <section aria-label="ملف الوكيل 360 درجة" className="ui-page-stack">
  <Card title="ملف الوكيل 360°"><FormField label="الوكيل"><EntityPicker value={id} onChange={value=>{setId(value);if(value)void load(value);}} options={choices.map(agentOption)} placeholder="اختر الوكيل"/></FormField><Button disabled={!id||loading} onClick={()=>void load()}>تحديث ملف الوكيل</Button></Card>
  {loading?<LoadingState/>:error?<ErrorState message={error}/>:data?<>
   <Card title={`${data.agent.agent.number} — ${data.agent.party.displayName}`}><p>الحالة: {data.agent.agent.status} | الشروط التجارية الافتراضية: {data.agent.agent.commission.kind} {data.agent.agent.commission.value} {data.agent.agent.commission.currency??''}</p><small>الشروط التجارية هنا مرجع CRM، أما العمولة المحاسبية الفعلية فتبقى عند المالك المالي.</small></Card>
   <Card title="العلاقات التجارية"><p>العملاء المسندون: {data.customers.length} | العملاء المحتملون المحالون: {data.leads.length} | عروض مرتبطة: {data.quotations.length}</p></Card>
   <Card title="العملاء">{!data.customers.length?<EmptyState/>:<DataGrid columns={['الرقم','الاسم','الحالة']}>{data.customers.map(v=><tr key={v.customer.id}><td>{v.customer.number}</td><td>{v.party.displayName}</td><td>{v.customer.status}</td></tr>)}</DataGrid>}</Card>
   <Card title="عروض الأسعار المرتبطة">{!data.quotations.length?<EmptyState/>:<DataGrid columns={['الرقم','الحالة','العميل','العملة']}>{data.quotations.map(v=><tr key={v.id}><td>{v.number}</td><td>{v.status}</td><td>{v.customerSnapshot.displayName}</td><td>{v.currency}</td></tr>)}</DataGrid>}</Card>
  </>:<EmptyState title="اختر وكيلًا لعرض ملفه الموحد"/>}
 </section>;
}
