import { useEffect, useMemo, useState } from 'react';
import { ActionBar, Badge, Button, Card, DataGrid, EmptyState, ErrorState, FormField, Select } from './ui.js';
import {
  tourismServicesApi,
  type AgentReference,
  type CustomerReference,
  type Fulfillment,
  type ServiceFinancialView,
  type ServiceRecord,
  type ServiceRow,
  type ServiceType,
  type SupplierReference,
  type TravelerReference,
  type Voucher,
} from './tourism-services-client.js';

const SCALE=10n**18n;
function units(value:string){const text=value.trim();if(!/^-?\d+(?:\.\d+)?$/.test(text))return 0n;const negative=text.startsWith('-'),raw=negative?text.slice(1):text;const[whole,fraction='']=raw.split('.');const result=BigInt(whole+fraction.padEnd(18,'0').slice(0,18));return negative?-result:result;}
function decimal(value:bigint){const negative=value<0n,absolute=negative?-value:value,whole=absolute/SCALE,fraction=absolute%SCALE;const rendered=fraction===0n?whole.toString():whole+'.'+fraction.toString().padStart(18,'0').replace(/0+$/,'');return negative?'-'+rendered:rendered;}
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'حدث خطأ غير متوقع';
const STATUS_LABELS:Record<string,string>={DRAFT:'مسودة',CONFIRMING:'قيد التأكيد',CONFIRMED:'مؤكدة',CANCELLATION_REQUESTED:'طلب إلغاء',CANCELLED:'ملغاة',COMPLETED:'مكتملة',ACTIVE:'نشط'};
const statusLabel=(status:string)=>STATUS_LABELS[status]??status;
const statusTone=(status:string):'success'|'warning'|'error'|'neutral'=>status==='CONFIRMED'||status==='COMPLETED'||status==='ACTIVE'?'success':status==='CANCELLED'?'error':status==='CONFIRMING'||status==='CANCELLATION_REQUESTED'?'warning':'neutral';

export function TourismService360Page(){
  const[services,setServices]=useState<ServiceRow[]>([]),[types,setTypes]=useState<ServiceType[]>([]),[customers,setCustomers]=useState<CustomerReference[]>([]),[agents,setAgents]=useState<AgentReference[]>([]),[suppliers,setSuppliers]=useState<SupplierReference[]>([]),[travelers,setTravelers]=useState<TravelerReference[]>([]);
  const[selectedId,setSelectedId]=useState(''),[record,setRecord]=useState<ServiceRecord|null>(null),[financial,setFinancial]=useState<ServiceFinancialView|null>(null),[fulfillment,setFulfillment]=useState<Fulfillment|null>(null),[vouchers,setVouchers]=useState<Voucher[]>([]);
  const[error,setError]=useState(''),[financeWarning,setFinanceWarning]=useState(''),[loading,setLoading]=useState(false);

  useEffect(()=>{void (async()=>{const results=await Promise.allSettled([tourismServicesApi.list(),tourismServicesApi.types(),tourismServicesApi.customers(),tourismServicesApi.agents(),tourismServicesApi.suppliers(),tourismServicesApi.travelers()]);if(results[0].status==='fulfilled')setServices(results[0].value);else setError(errorMessage(results[0].reason));if(results[1].status==='fulfilled')setTypes(results[1].value);if(results[2].status==='fulfilled')setCustomers(results[2].value);if(results[3].status==='fulfilled')setAgents(results[3].value);if(results[4].status==='fulfilled')setSuppliers(results[4].value);if(results[5].status==='fulfilled')setTravelers(results[5].value);})();},[]);

  async function load(id:string){setSelectedId(id);setRecord(null);setFinancial(null);setFulfillment(null);setVouchers([]);setFinanceWarning('');setError('');if(!id)return;setLoading(true);const results=await Promise.allSettled([tourismServicesApi.get(id),tourismServicesApi.financials(id),tourismServicesApi.fulfillment(id),tourismServicesApi.vouchers(id)]);if(results[0].status==='fulfilled')setRecord(results[0].value);else setError(errorMessage(results[0].reason));if(results[1].status==='fulfilled')setFinancial(results[1].value);else setFinanceWarning('البيانات المالية غير متاحة بالصلاحيات الحالية أو تعذر تحميلها.');if(results[2].status==='fulfilled')setFulfillment(results[2].value);if(results[3].status==='fulfilled')setVouchers(results[3].value);setLoading(false);}

  const names=useMemo(()=>({customers:new Map(customers.map(item=>[item.party.id,item.party.displayName])),agents:new Map(agents.map(item=>[item.party.id,item.party.displayName])),suppliers:new Map(suppliers.map(item=>[item.party.id,item.party.displayName])),travelers:new Map(travelers.map(item=>[item.id,item.fullName]))}),[customers,agents,suppliers,travelers]);
  const snapshot=financial?.finance.snapshot??null;
  const profit=snapshot?decimal(units(snapshot.saleAmount)-units(snapshot.costAmount)):'—';
  const supplierOutstanding=financial?decimal(financial.supplierInvoices.reduce((sum,item)=>sum+units(item.outstanding),0n)):'—';
  const travelerIds=record&&Array.isArray(record.revision.details.travelerIds)?record.revision.details.travelerIds.filter((item):item is string=>typeof item==='string'):[];
  const debtorName=record?(record.revision.debtorKind==='CUSTOMER'?names.customers.get(record.revision.debtorPartyId):names.agents.get(record.revision.debtorPartyId)):undefined;
  function financialAction(action:'receipt'|'advance-refund'){if(!record)return;window.location.href=`/crm/financial-action?action=${action}&partyKind=${record.revision.debtorKind}&partyId=${encodeURIComponent(record.revision.debtorPartyId)}`;}

  return <section aria-label="ملف الخدمة 360">
    <Card title="ملف الخدمة 360°"><FormField label="الخدمة"><Select value={selectedId} onChange={e=>void load(e.target.value)}><option value="">اختر خدمة</option>{services.map(service=><option key={service.id} value={service.id}>{service.number} — {statusLabel(service.status)}</option>)}</Select></FormField>{error&&<ErrorState message={error}/>} {loading&&<p role="status">جاري تحميل الملف التشغيلي والمالي للخدمة…</p>}</Card>

    {record&&!loading&&<>
      <Card title={'الخدمة '+record.service.number}>
        <p>الحالة: <Badge tone={statusTone(record.service.status)}>{statusLabel(record.service.status)}</Badge> · الإصدار: {record.revision.revision}</p>
        <DataGrid columns={['نوع الخدمة','تاريخ الخدمة','حتى','الكمية','العميل','المدين','العملة']}><tr><td>{types.find(type=>type.id===record.revision.serviceTypeId)?.nameAr??record.revision.category}</td><td>{record.revision.serviceDate}</td><td>{record.revision.periodEnd??'—'}</td><td>{record.revision.quantity}</td><td>{names.customers.get(record.revision.customerPartyId)??record.revision.customerPartyId}</td><td>{debtorName??record.revision.debtorPartyId}</td><td>{record.revision.commercial.currency}</td></tr></DataGrid>
        <p>المسافرون: {travelerIds.length?travelerIds.map(id=>names.travelers.get(id)??id).join('، '):'—'}</p>
        <ActionBar><Button variant="secondary" onClick={()=>{window.location.href='/tourism/service-documents?serviceId='+encodeURIComponent(record.service.id);}}>المستندات والمرفقات</Button><Button variant="secondary" onClick={()=>financialAction('receipt')}>تحصيل من العميل/المندوب</Button><Button variant="secondary" onClick={()=>financialAction('advance-refund')}>رد مقدم</Button><Button variant="secondary" onClick={()=>{window.location.href='/accounting';}}>فتح المحاسبة والسداد</Button></ActionBar>
      </Card>

      <Card title="المؤشرات المالية والربحية">{financeWarning&&<p role="note">{financeWarning}</p>}{snapshot?<DataGrid columns={['المبيعات','التكلفة','مجمل الربح','مستحق على العميل','مستحق للموردين','العملة','الإصدار المالي']}><tr><td>{snapshot.saleAmount}</td><td>{snapshot.costAmount}</td><td>{profit}</td><td>{financial?.customerInvoice?.outstanding??'0'}</td><td>{supplierOutstanding}</td><td>{snapshot.currency}</td><td>{snapshot.version}</td></tr></DataGrid>:financial?<EmptyState title="الخدمة لم تُنشئ Snapshot مالية بعد"/>:null}</Card>

      <Card title="فاتورة العميل والتحصيل">{financial?.customerInvoice?<DataGrid columns={['الفاتورة','التاريخ','الاستحقاق','الإجمالي','المتبقي','الحالة','العملة']}><tr><td>{financial.customerInvoice.number}</td><td>{financial.customerInvoice.postingDate}</td><td>{financial.customerInvoice.dueDate??'—'}</td><td>{financial.customerInvoice.documentTotal}</td><td>{financial.customerInvoice.outstanding}</td><td><Badge tone={financial.customerInvoice.status==='POSTED'?'success':'neutral'}>{financial.customerInvoice.status}</Badge></td><td>{financial.customerInvoice.currency}</td></tr></DataGrid>:financial?<EmptyState title="لا توجد فاتورة عميل مرتبطة بالخدمة"/>:null}</Card>

      <Card title="التوريد وأوامر الموردين">{financial?.purchaseOrders.length?<DataGrid columns={['PO','المورد','الحالة','التاريخ','العملة','البنود']}>{financial.purchaseOrders.map(po=><tr key={po.id}><td>{po.number}</td><td>{names.suppliers.get(po.supplierId)??po.supplierId}</td><td><Badge tone={po.status==='CANCELLED'?'error':'neutral'}>{po.status}</Badge></td><td>{po.orderDate??'—'}</td><td>{po.currency??'—'}</td><td>{po.lines.length}</td></tr>)}</DataGrid>:financial?<EmptyState title="لا توجد أوامر شراء خارجية مرتبطة بالخدمة"/>:null}</Card>

      <Card title="فواتير الموردين والسداد">{financial?.supplierInvoices.length?<DataGrid columns={['الفاتورة','فاتورة المورد','المورد','الإجمالي','المتبقي','الحالة','العملة']}>{financial.supplierInvoices.map(invoice=><tr key={invoice.id}><td>{invoice.number}</td><td>{invoice.externalInvoiceNumber??'—'}</td><td>{names.suppliers.get(invoice.partyId)??invoice.partyId}</td><td>{invoice.documentTotal}</td><td>{invoice.outstanding}</td><td><Badge tone={invoice.status==='POSTED'?'success':'neutral'}>{invoice.status}</Badge></td><td>{invoice.currency}</td></tr>)}</DataGrid>:financial?<EmptyState title="لا توجد فواتير مورد مرتبطة بأوامر شراء الخدمة"/>:null}</Card>

      <Card title="التنفيذ والتأكيدات">{fulfillment?<><p>الحالة: {fulfillment.case.status} · الكمية المؤكدة: {fulfillment.case.confirmedQuantity} · المسلمة: {fulfillment.case.deliveredQuantity} / {fulfillment.case.quantity}</p>{fulfillment.confirmations.length?<DataGrid columns={['المرجع','المورد','الكمية']}>{fulfillment.confirmations.map((item,index)=><tr key={item.reference+'-'+index}><td>{item.reference}</td><td>{item.supplierId?names.suppliers.get(item.supplierId)??item.supplierId:'تغطية داخلية'}</td><td>{item.quantity}</td></tr>)}</DataGrid>:<EmptyState title="لا توجد تأكيدات مورد"/>}</>:<EmptyState title="لا يوجد ملف تنفيذ بعد"/>}</Card>

      <Card title="الفاوتشرات">{vouchers.length?<DataGrid columns={['الرقم','الحالة','الإصدار']}>{vouchers.map(voucher=><tr key={voucher.id}><td>{voucher.number}</td><td><Badge tone={voucher.status==='ISSUED'?'success':'error'}>{voucher.status}</Badge></td><td>{voucher.version}</td></tr>)}</DataGrid>:<EmptyState title="لا توجد فاوتشرات"/>}</Card>

      <Card title="Activity / Audit">{record.history.length?<DataGrid columns={['الحدث','التاريخ','المستخدم']}>{record.history.map((item,index)=><tr key={item.createdAt+'-'+index}><td>{item.kind}</td><td>{item.createdAt}</td><td>{item.actorId}</td></tr>)}</DataGrid>:<EmptyState title="لا يوجد سجل نشاط"/>}</Card>
    </>}
  </section>;
}
