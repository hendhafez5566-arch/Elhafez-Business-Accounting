import { useEffect, useState } from 'react';
import { ActionBar, Badge, Card, DataGrid, EmptyState, ErrorState, FormField, Input, LoadingState, MetricCard, Select } from './ui.js';
import { managementControlApi, type AttentionSeverity, type ManagementControlApi, type ManagementDomain, type ManagementFilters, type ManagementOverview } from './management-control-client.js';

const domainLabel:Record<ManagementDomain,string>={CRM_SALES:'العملاء والمبيعات',SUPPLIERS_PROCUREMENT:'الموردون والمشتريات',HAJJ_UMRAH:'الحج والعمرة',FINANCE:'المالية والرقابة'};
const severityLabel:Record<AttentionSeverity,string>={CRITICAL:'حرج',HIGH:'مرتفع',NORMAL:'عادي'};
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'تعذر تحميل مركز الإدارة والتحكم.';

function AttentionTable({data,limit}:{readonly data:ManagementOverview;readonly limit?:number}) {
  const items=limit===undefined?data.items:data.items.slice(0,limit);
  if(!items.length)return <EmptyState title="لا توجد بنود تتطلب الانتباه">لا توجد استثناءات مطابقة للنطاق والفلاتر الحالية.</EmptyState>;
  return <Card title={limit===undefined?'بنود العمل والاستثناءات':'أولويات تتطلب المتابعة'}><DataGrid columns={['الأولوية','المجال','البند','الحالة','التاريخ','الانتقال للمصدر']}>{items.map(item=><tr key={item.sourceKey}><td><Badge tone={item.severity==='CRITICAL'?'error':item.severity==='HIGH'?'warning':'info'}>{severityLabel[item.severity]}</Badge></td><td>{domainLabel[item.sourceDomain]}</td><td><strong>{item.title}</strong><small className="ui-block">{item.summary}</small></td><td>{item.status}</td><td>{item.occurredAt?new Date(item.occurredAt).toLocaleDateString('ar-EG'):'—'}</td><td><a href={item.drillDownPath}>فتح مساحة العمل الأصلية</a></td></tr>)}</DataGrid></Card>;
}

function RecentAttention({data}:{readonly data:ManagementOverview}){
 const items=data.items.slice(0,5);
 return <Card title="أحدث النشاطات والتنبيهات">{items.length?<div className="ui-admin-workflows">{items.map(item=><section className="ui-disclosure-card" key={item.sourceKey}><div className="ui-disclosure-card__body"><div className="ui-inline"><Badge tone={item.severity==='CRITICAL'?'error':item.severity==='HIGH'?'warning':'info'}>{severityLabel[item.severity]}</Badge><small>{domainLabel[item.sourceDomain]}</small></div><p><strong>{item.title}</strong></p><p className="ui-page-intro">{item.summary}</p><div className="ui-inline"><small>{item.occurredAt?new Date(item.occurredAt).toLocaleString('ar-EG'):'بدون تاريخ'}</small><a href={item.drillDownPath}>فتح المصدر</a></div></div></section>)}</div>:<EmptyState title="لا توجد نشاطات حالية"/>}<ActionBar><a href="/workcenter">عرض مركز العمل كاملًا</a></ActionBar></Card>;
}

export function ExecutiveDashboardView({data}:{readonly data:ManagementOverview}) {
 const summary=data.summary;
 const overdueAmount=summary.finance.overdueByCurrency.map(value=>`${value.amount} ${value.currency}`).join(' | ')||'0';
 return <section className="ui-dashboard" dir="rtl" aria-label="لوحة الإدارة التنفيذية">
  <Card><div className="ui-inline"><div><h2>مرحباً بك 👋</h2><p className="ui-page-intro">إليك ملخص أداء الشركة وأهم البنود التي تحتاج متابعة الآن.</p></div></div></Card>
  <div className="ui-metric-grid" aria-label="مؤشرات لوحة القيادة">
   <MetricCard label="بنود تحتاج انتباه الإدارة" value={data.totals.attention} detail="كل المجالات التشغيلية" tone="info"/>
   <MetricCard label="حالات حرجة" value={data.totals.critical} detail="تحتاج تدخلاً سريعاً" tone={data.totals.critical?'error':'neutral'}/>
   <MetricCard label="أولوية مرتفعة" value={data.totals.high} detail="بنود متابعة قريبة" tone={data.totals.high?'warning':'neutral'}/>
   <MetricCard label="مراكز مالية متأخرة" value={summary.finance.overduePositions} detail={overdueAmount} tone={summary.finance.overduePositions?'error':'success'}/>
  </div>
  <section className="ui-dashboard-grid" aria-label="تحليل الأداء وأحدث النشاطات">
   <Card title="ملخص الأداء التشغيلي">
    <div className="ui-metric-grid">
     <MetricCard label="العملاء" value={summary.crmSales.customers} detail={`الوكلاء ${summary.crmSales.agents} • المسافرون ${summary.crmSales.travelers}`} tone="info"/>
     <MetricCard label="متابعات متأخرة" value={summary.crmSales.overdueFollowups} detail={`عروض مقبولة ${summary.crmSales.quotationStatuses.ACCEPTED??0}`} tone={summary.crmSales.overdueFollowups?'warning':'success'}/>
     <MetricCard label="نزاعات الموردين" value={summary.suppliers.openDisputes} detail={`إيقافات نشطة ${summary.suppliers.activeHolds}`} tone={summary.suppliers.openDisputes?'warning':'success'}/>
     <MetricCard label="جاهزية الحج والعمرة" value={summary.hajjUmrah.readinessItems} detail={`حرجة ${summary.hajjUmrah.criticalReadinessItems} • برامج نشطة ${summary.hajjUmrah.activePrograms}`} tone={summary.hajjUmrah.criticalReadinessItems?'error':'success'}/>
    </div>
    <ActionBar><a href="/crm/dashboard">العملاء والمبيعات</a><a href="/procurement/supplier-intelligence">الموردون</a><a href="/hajj-umrah/readiness">جاهزية الحج والعمرة</a><a href="/accounting">المحاسبة والمالية</a></ActionBar>
   </Card>
   <RecentAttention data={data}/>
  </section>
  <AttentionTable data={data} limit={5}/>
 </section>;
}

function WorkCenterGroups({data}:{readonly data:ManagementOverview}){
 if(!data.items.length)return <EmptyState title="لا توجد بنود تتطلب الانتباه">لا توجد استثناءات مطابقة للنطاق والفلاتر الحالية.</EmptyState>;
 return <section className="ui-admin-workflows" aria-label="مجموعات مركز العمل">
  {(Object.keys(domainLabel) as ManagementDomain[]).map(domain=>{
   const items=data.items.filter(item=>item.sourceDomain===domain);
   if(!items.length)return null;
   return <details key={domain} className="ui-disclosure-card" open>
    <summary><strong>{domainLabel[domain]}</strong> <Badge tone="info">{items.length}</Badge></summary>
    <div className="ui-disclosure-card__body">
     <DataGrid columns={['الأولوية','البند','الفئة','الحالة','التاريخ','الإجراء']}>
      {items.map(item=><tr key={item.sourceKey}><td><Badge tone={item.severity==='CRITICAL'?'error':item.severity==='HIGH'?'warning':'info'}>{severityLabel[item.severity]}</Badge></td><td><strong>{item.title}</strong><small className="ui-block">{item.summary}</small></td><td>{item.category||'—'}</td><td>{item.status}</td><td>{item.occurredAt?new Date(item.occurredAt).toLocaleString('ar-EG'):'—'}</td><td><a href={item.drillDownPath}>فتح المصدر</a></td></tr>)}
     </DataGrid>
    </div>
   </details>;
  })}
 </section>;
}

export function ManagementWorkCenterView({data,filters,onFilters}:{readonly data:ManagementOverview;readonly filters:ManagementFilters;readonly onFilters:(value:ManagementFilters)=>void}) { return <section className="ui-work-center" dir="rtl" aria-label="مركز العمل اليومي">
  <Card title="مركز العمل اليومي"><p className="ui-page-intro">تصفية البنود القابلة للتنفيذ حسب الأولوية والمجال ثم فتح المالك المعتمد. يمكن توسيع أو طي كل مجموعة عمل.</p></Card>
  <div className="ui-metric-grid"><MetricCard label="تحتاج متابعة" value={data.totals.attention} tone={data.totals.attention?'warning':'success'}/><MetricCard label="حرجة" value={data.totals.critical} tone={data.totals.critical?'error':'success'}/><MetricCard label="الحج والعمرة" value={data.domains.find(row=>row.domain==='HAJJ_UMRAH')?.count??0}/><MetricCard label="مالية واعتمادات" value={data.domains.find(row=>row.domain==='FINANCE')?.count??0}/></div>
  <Card title="فلاتر العمل"><div className="ui-filter-grid"><FormField label="المجال"><Select aria-label="المجال" value={filters.domain??''} onChange={event=>onFilters({...filters,domain:(event.target.value||undefined)as ManagementDomain|undefined})}><option value="">كل المجالات</option>{Object.entries(domainLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select></FormField><FormField label="الأولوية"><Select aria-label="الأولوية" value={filters.severity??''} onChange={event=>onFilters({...filters,severity:(event.target.value||undefined)as AttentionSeverity|undefined})}><option value="">كل الأولويات</option>{Object.entries(severityLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select></FormField><FormField label="الحالة"><Input aria-label="الحالة" value={filters.status??''} onChange={event=>onFilters({...filters,status:event.target.value||undefined})}/></FormField><FormField label="الفئة"><Input aria-label="الفئة" value={filters.category??''} onChange={event=>onFilters({...filters,category:event.target.value||undefined})}/></FormField><FormField label="من تاريخ"><Input aria-label="من تاريخ" type="date" value={filters.from??''} onChange={event=>onFilters({...filters,from:event.target.value||undefined})}/></FormField><FormField label="إلى تاريخ"><Input aria-label="إلى تاريخ" type="date" value={filters.to??''} onChange={event=>onFilters({...filters,to:event.target.value||undefined})}/></FormField></div></Card>
  <p className="ui-results-count">النتائج المعروضة: {data.items.length} من {data.totals.attention}</p><WorkCenterGroups data={data}/>
 </section>; }

function ManagementPage({mode,api=managementControlApi}:{readonly mode:'executive'|'work-center';readonly api?:ManagementControlApi}) { const[data,setData]=useState<ManagementOverview>(); const[filters,setFilters]=useState<ManagementFilters>({}); const[loading,setLoading]=useState(true); const[error,setError]=useState(''); useEffect(()=>{let active=true;setLoading(true);setError('');api.overview(mode==='executive'?{}:filters).then(value=>active&&setData(value)).catch(reason=>active&&setError(errorMessage(reason))).finally(()=>active&&setLoading(false));return()=>{active=false};},[api,filters,mode]); if(loading)return <LoadingState/>;if(error)return <ErrorState message={error}/>;if(!data)return <EmptyState/>;return mode==='executive'?<ExecutiveDashboardView data={data}/>:<ManagementWorkCenterView data={data} filters={filters} onFilters={setFilters}/>; }
export function ExecutiveDashboardPage({api=managementControlApi}:{readonly api?:ManagementControlApi}) { return <ManagementPage mode="executive" api={api}/>; }
export function ManagementWorkCenterPage({api=managementControlApi}:{readonly api?:ManagementControlApi}) { return <ManagementPage mode="work-center" api={api}/>; }
