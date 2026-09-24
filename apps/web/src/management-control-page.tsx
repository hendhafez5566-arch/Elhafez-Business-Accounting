import { useEffect, useState } from 'react';
import { Badge, Card, DataGrid, EmptyState, ErrorState, Input, LoadingState, Select } from './ui.js';
import { managementControlApi, type AttentionSeverity, type ManagementControlApi, type ManagementDomain, type ManagementFilters, type ManagementOverview } from './management-control-client.js';

const domainLabel:Record<ManagementDomain,string>={CRM_SALES:'العملاء والمبيعات',SUPPLIERS_PROCUREMENT:'الموردون والمشتريات',HAJJ_UMRAH:'الحج والعمرة',FINANCE:'المالية والرقابة'};
const severityLabel:Record<AttentionSeverity,string>={CRITICAL:'حرج',HIGH:'مرتفع',NORMAL:'عادي'};
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'تعذر تحميل مركز الإدارة والتحكم.';

function AttentionTable({data,limit}:{readonly data:ManagementOverview;readonly limit?:number}) {
  const items=limit===undefined?data.items:data.items.slice(0,limit);
  if(!items.length)return <EmptyState title="لا توجد بنود تتطلب الانتباه">لا توجد استثناءات مطابقة للنطاق والفلاتر الحالية.</EmptyState>;
  return <Card title={limit===undefined?'بنود العمل والاستثناءات':'أولويات تتطلب المتابعة'}><DataGrid columns={['الأولوية','المجال','البند','الحالة','التاريخ','الانتقال للمصدر']}>{items.map(item=><tr key={item.sourceKey}><td><Badge tone={item.severity==='CRITICAL'?'error':item.severity==='HIGH'?'warning':'info'}>{severityLabel[item.severity]}</Badge></td><td>{domainLabel[item.sourceDomain]}</td><td><strong>{item.title}</strong><small className="ui-block">{item.summary}</small></td><td>{item.status}</td><td>{item.occurredAt?new Date(item.occurredAt).toLocaleDateString('ar-EG'):'—'}</td><td><a href={item.drillDownPath}>فتح مساحة العمل الأصلية</a></td></tr>)}</DataGrid></Card>;
}

export function ExecutiveDashboardView({data}:{readonly data:ManagementOverview}) { const summary=data.summary; return <main dir="rtl" aria-label="لوحة الإدارة التنفيذية">
  <h1>لوحة الإدارة التنفيذية</h1>
  <section aria-label="مؤشرات الانتباه"><Card title="بنود تحتاج انتباه الإدارة"><strong>{data.totals.attention}</strong></Card><Card title="حالات حرجة"><strong>{data.totals.critical}</strong></Card><Card title="أولوية مرتفعة"><strong>{data.totals.high}</strong></Card></section>
  <section aria-label="ملخص الأعمال">
    <Card title="العملاء والمبيعات"><p>العملاء: {summary.crmSales.customers} | الوكلاء: {summary.crmSales.agents} | المسافرون: {summary.crmSales.travelers}</p><p>متابعات متأخرة: {summary.crmSales.overdueFollowups} | عروض مقبولة: {summary.crmSales.quotationStatuses.ACCEPTED??0}</p><p>{summary.crmSales.quotationValueByCurrency.map(value=>`${value.total} ${value.currency}`).join(' | ')||'لا توجد قيمة عروض مسجلة'}</p><a href="/crm/dashboard">فتح لوحة العملاء والمبيعات</a></Card>
    <Card title="الموردون والمشتريات"><p>الموردون: {summary.suppliers.total} | النزاعات المفتوحة: {summary.suppliers.openDisputes} | الإيقافات النشطة: {summary.suppliers.activeHolds}</p><a href="/procurement/supplier-intelligence">فتح متابعة الموردين</a></Card>
    <Card title="جاهزية الحج والعمرة"><p>البرامج النشطة: {summary.hajjUmrah.activePrograms} | بنود الجاهزية: {summary.hajjUmrah.readinessItems} | حرجة: {summary.hajjUmrah.criticalReadinessItems}</p><a href="/hajj-umrah/readiness">فتح مركز الجاهزية</a></Card>
    <Card title="المراكز المالية المستحقة"><p>المراكز المتأخرة: {summary.finance.overduePositions}</p><p>{summary.finance.overdueByCurrency.map(value=>`${value.amount} ${value.currency}`).join(' | ')||'لا توجد ذمم متأخرة'}</p></Card>
  </section>
  <AttentionTable data={data} limit={5}/><a href="/management/exceptions">عرض مركز العمل والاستثناءات</a>
 </main>; }

export function ManagementWorkCenterView({data,filters,onFilters}:{readonly data:ManagementOverview;readonly filters:ManagementFilters;readonly onFilters:(value:ManagementFilters)=>void}) { return <main dir="rtl" aria-label="مركز العمل والاستثناءات">
  <h1>مركز العمل والاستثناءات</h1><p>تصفية البنود القابلة للتنفيذ والانتقال إلى مساحة المالك المعتمد.</p>
  <Card title="فلاتر العمل"><label>المجال<Select aria-label="المجال" value={filters.domain??''} onChange={event=>onFilters({...filters,domain:(event.target.value||undefined)as ManagementDomain|undefined})}><option value="">كل المجالات</option>{Object.entries(domainLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select></label><label>الأولوية<Select aria-label="الأولوية" value={filters.severity??''} onChange={event=>onFilters({...filters,severity:(event.target.value||undefined)as AttentionSeverity|undefined})}><option value="">كل الأولويات</option>{Object.entries(severityLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select></label><label>الحالة<Input aria-label="الحالة" value={filters.status??''} onChange={event=>onFilters({...filters,status:event.target.value||undefined})}/></label><label>الفئة<Input aria-label="الفئة" value={filters.category??''} onChange={event=>onFilters({...filters,category:event.target.value||undefined})}/></label><label>من تاريخ<Input aria-label="من تاريخ" type="date" value={filters.from??''} onChange={event=>onFilters({...filters,from:event.target.value||undefined})}/></label><label>إلى تاريخ<Input aria-label="إلى تاريخ" type="date" value={filters.to??''} onChange={event=>onFilters({...filters,to:event.target.value||undefined})}/></label></Card>
  <p>النتائج المعروضة: {data.items.length} من {data.totals.attention}</p><AttentionTable data={data}/>
 </main>; }

function ManagementPage({mode,api=managementControlApi}:{readonly mode:'executive'|'work-center';readonly api?:ManagementControlApi}) { const[data,setData]=useState<ManagementOverview>(); const[filters,setFilters]=useState<ManagementFilters>({}); const[loading,setLoading]=useState(true); const[error,setError]=useState(''); useEffect(()=>{let active=true;setLoading(true);setError('');api.overview(mode==='executive'?{}:filters).then(value=>active&&setData(value)).catch(reason=>active&&setError(errorMessage(reason))).finally(()=>active&&setLoading(false));return()=>{active=false};},[api,filters,mode]); if(loading)return <LoadingState/>;if(error)return <ErrorState message={error}/>;if(!data)return <EmptyState/>;return mode==='executive'?<ExecutiveDashboardView data={data}/>:<ManagementWorkCenterView data={data} filters={filters} onFilters={setFilters}/>; }
export function ExecutiveDashboardPage({api=managementControlApi}:{readonly api?:ManagementControlApi}) { return <ManagementPage mode="executive" api={api}/>; }
export function ManagementWorkCenterPage({api=managementControlApi}:{readonly api?:ManagementControlApi}) { return <ManagementPage mode="work-center" api={api}/>; }
