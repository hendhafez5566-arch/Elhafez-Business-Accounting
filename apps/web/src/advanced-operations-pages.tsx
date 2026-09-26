import { type FormEvent, useEffect, useState } from 'react';
import {
  ActionBar,
  Button,
  Card,
  DataGrid,
  FormField,
  Input,
  MetricCard,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  Toast,
} from './ui.js';
import {
  advancedOperationsApi as api,
  type ContractType,
  type JsonRecord,
  type ServiceCategory,
} from './advanced-operations-client.js';

const errorMessage=(error:unknown)=>error instanceof Error?error.message:'تعذر تنفيذ العملية.';
const today=()=>new Date().toISOString().slice(0,10);
const nowIso=()=>new Date().toISOString();
const record=(value:unknown):value is JsonRecord=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const label:Record<string,string>={
  id:'المعرّف',code:'الكود',name:'الاسم',status:'الحالة',currency:'العملة',amount:'المبلغ',rate:'السعر',
  fromCurrency:'من عملة',toCurrency:'إلى عملة',effectiveAt:'ساري في',source:'المصدر',precision:'الدقة',isBase:'العملة الأساسية',
  costCenterId:'مركز التكلفة',periodStart:'من',periodEnd:'إلى',actual:'الفعلي',remaining:'المتبقي',exceeded:'تجاوز الموازنة',
  groupId:'مجموعة الأطراف',customerInvoiceId:'فاتورة العميل',supplierInvoiceId:'فاتورة المورد',postingDate:'تاريخ الترحيل',
  number:'الرقم',form:'النوع',agentPartyId:'الوكيل',baseCarryingAmount:'القيمة الدفترية',contractId:'العقد',
  type:'النوع',supplierId:'المورد',effectiveFrom:'ساري من',effectiveTo:'ساري إلى',resourceType:'نوع المورد',resourceId:'المورد/السعة',
  available:'متاح',availableQuantity:'الكمية المتاحة',quantity:'الكمية',createdAt:'تاريخ الإنشاء',versionNumber:'الإصدار',
};
function valueText(value:unknown){
  if(value===null||value===undefined)return'—';
  if(typeof value==='boolean')return value?'نعم':'لا';
  if(Array.isArray(value))return String(value.length);
  if(typeof value==='object')return'بيانات مرتبطة';
  return String(value);
}
function ResultCard({title,value}:{title:string;value:unknown}){
  if(!record(value))return null;
  const rows=Object.entries(value).filter(([key,v])=>label[key]&&typeof v!=='object');
  if(!rows.length)return null;
  return <Card title={title}><DataGrid columns={['البيان','القيمة']}>{rows.map(([key,value])=><tr key={key}><td>{label[key]??key}</td><td>{valueText(value)}</td></tr>)}</DataGrid></Card>;
}
function useAction(){
  const[result,setResult]=useState<unknown>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  async function run(message:string,action:()=>Promise<unknown>){
    setBusy(true);setNotice('');
    try{const value=await action();setResult(value);setNotice(message);}
    catch(error){setNotice(errorMessage(error));}
    finally{setBusy(false);}
  }
  return{result,notice,busy,run,setResult};
}

export type AdvancedAccountingSection='currency'|'cost'|'party'|'ecr'|'assets';
const accountingTabs=[
  {id:'currency',label:'العملات وأسعار الصرف'},
  {id:'cost',label:'مراكز التكلفة والموازنات'},
  {id:'party',label:'حسابات الأطراف والمقاصة'},
  {id:'ecr',label:'المصروفات والعمولات والاستحقاقات'},
  {id:'assets',label:'الأصول والتمويل'},
];

export function AdvancedAccountingPage({initialSection='currency'}:{initialSection?:AdvancedAccountingSection}){
  const[section,setSection]=useState(initialSection);
  useEffect(()=>setSection(initialSection),[initialSection]);
  return <section dir="rtl" className="ui-page-stack">
    <PageHeader eyebrow="المحاسبة والمالية" title="العمليات المالية المتقدمة" description="واجهات تشغيل مباشرة فوق المالك المحاسبي المعتمد لكل حقيقة؛ بدون أرصدة أو قيود مكررة."/>
    <Tabs tabs={accountingTabs} active={section} onChange={id=>setSection(id as AdvancedAccountingSection)}/>
    {section==='currency'?<CurrencyFxSection/>:null}
    {section==='cost'?<CostBudgetSection/>:null}
    {section==='party'?<PartyAccountingSection/>:null}
    {section==='ecr'?<EcrSection/>:null}
    {section==='assets'?<AssetsFinancingSection/>:null}
  </section>;
}

function CurrencyFxSection(){
  const a=useAction();
  const[currency,setCurrency]=useState({code:'EGP',precision:'2',isBase:true,status:'ACTIVE' as 'ACTIVE'|'INACTIVE'});
  const[rate,setRate]=useState({id:'',fromCurrency:'USD',toCurrency:'EGP',effectiveAt:nowIso(),rate:'',source:'MANUAL'});
  const[resolve,setResolve]=useState({fromCurrency:'USD',toCurrency:'EGP',at:nowIso()});
  return <div className="ui-page-stack">
    <div className="ui-metric-grid"><MetricCard label="المالك" value="Currency & FX"/><MetricCard label="الاستخدام" value="تعريف العملات وأسعار الصرف"/><MetricCard label="مصدر الحقيقة" value="currency-fx"/></div>
    {a.notice?<Toast tone={a.notice.startsWith('تم')?'success':'error'}>{a.notice}</Toast>:null}
    <div className="ui-grid-md">
      <Card title="تعريف عملة"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم حفظ إعداد العملة.',()=>api.configureCurrency({code:currency.code.toUpperCase(),precision:Number(currency.precision),isBase:currency.isBase,status:currency.status}))}}>
        <FormField label="كود العملة" required><Input required maxLength={3} value={currency.code} onChange={e=>setCurrency({...currency,code:e.target.value.toUpperCase()})}/></FormField>
        <FormField label="الدقة"><Input required type="number" min="0" max="9" value={currency.precision} onChange={e=>setCurrency({...currency,precision:e.target.value})}/></FormField>
        <FormField label="النوع"><Select value={currency.isBase?'BASE':'OTHER'} onChange={e=>setCurrency({...currency,isBase:e.target.value==='BASE'})}><option value="BASE">عملة أساسية</option><option value="OTHER">عملة إضافية</option></Select></FormField>
        <FormField label="الحالة"><Select value={currency.status} onChange={e=>setCurrency({...currency,status:e.target.value as 'ACTIVE'|'INACTIVE'})}><option value="ACTIVE">نشطة</option><option value="INACTIVE">غير نشطة</option></Select></FormField>
        <Button type="submit" loading={a.busy}>حفظ العملة</Button>
      </form></Card>
      <Card title="نشر سعر صرف"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم نشر سعر الصرف.',()=>api.publishRate({...rate,id:rate.id||crypto.randomUUID()}))}}>
        <FormField label="من" required><Input required value={rate.fromCurrency} onChange={e=>setRate({...rate,fromCurrency:e.target.value.toUpperCase()})}/></FormField>
        <FormField label="إلى" required><Input required value={rate.toCurrency} onChange={e=>setRate({...rate,toCurrency:e.target.value.toUpperCase()})}/></FormField>
        <FormField label="السعر" required><Input required inputMode="decimal" value={rate.rate} onChange={e=>setRate({...rate,rate:e.target.value})}/></FormField>
        <FormField label="ساري في UTC" required><Input required value={rate.effectiveAt} onChange={e=>setRate({...rate,effectiveAt:e.target.value})}/></FormField>
        <FormField label="المصدر" required><Input required value={rate.source} onChange={e=>setRate({...rate,source:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>نشر السعر</Button>
      </form></Card>
    </div>
    <Card title="استعلام سعر صرف"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم تحميل سعر الصرف.',()=>api.resolveRate(resolve))}}>
      <FormField label="من"><Input value={resolve.fromCurrency} onChange={e=>setResolve({...resolve,fromCurrency:e.target.value.toUpperCase()})}/></FormField>
      <FormField label="إلى"><Input value={resolve.toCurrency} onChange={e=>setResolve({...resolve,toCurrency:e.target.value.toUpperCase()})}/></FormField>
      <FormField label="في تاريخ/وقت UTC"><Input value={resolve.at} onChange={e=>setResolve({...resolve,at:e.target.value})}/></FormField>
      <ActionBar><Button type="submit" loading={a.busy}>عرض السعر</Button><Button type="button" variant="secondary" onClick={()=>void a.run('تم تحميل العملة الأساسية.',()=>api.baseCurrency())}>العملة الأساسية</Button></ActionBar>
    </form></Card>
    <ResultCard title="آخر نتيجة" value={a.result}/>
  </div>;
}

function CostBudgetSection(){
  const a=useAction();
  const[center,setCenter]=useState({id:'',code:'',name:'',parentId:''});
  const[budget,setBudget]=useState({id:'',costCenterId:'',periodStart:today(),periodEnd:today(),currency:'EGP',amount:''});
  const[lookup,setLookup]=useState('');
  const[budgetId,setBudgetId]=useState('');
  return <div className="ui-page-stack">
    {a.notice?<Toast tone={a.notice.startsWith('تم')?'success':'error'}>{a.notice}</Toast>:null}
    <div className="ui-grid-md">
      <Card title="مركز تكلفة جديد"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم إنشاء مركز التكلفة.',()=>api.createCostCenter({...center,id:center.id||crypto.randomUUID(),...(center.parentId?{parentId:center.parentId}:{})}))}}>
        <FormField label="الكود" required><Input required value={center.code} onChange={e=>setCenter({...center,code:e.target.value.toUpperCase()})}/></FormField>
        <FormField label="الاسم" required><Input required value={center.name} onChange={e=>setCenter({...center,name:e.target.value})}/></FormField>
        <FormField label="المركز الأب"><Input value={center.parentId} onChange={e=>setCenter({...center,parentId:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>إنشاء مركز</Button>
      </form></Card>
      <Card title="موازنة مركز تكلفة"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم إنشاء الموازنة كمسودة.',()=>api.createBudget({...budget,id:budget.id||crypto.randomUUID()}))}}>
        <FormField label="مركز التكلفة" required><Input required value={budget.costCenterId} onChange={e=>setBudget({...budget,costCenterId:e.target.value})}/></FormField>
        <FormField label="من" required><Input type="date" required value={budget.periodStart} onChange={e=>setBudget({...budget,periodStart:e.target.value})}/></FormField>
        <FormField label="إلى" required><Input type="date" required value={budget.periodEnd} onChange={e=>setBudget({...budget,periodEnd:e.target.value})}/></FormField>
        <FormField label="العملة" required><Input required value={budget.currency} onChange={e=>setBudget({...budget,currency:e.target.value.toUpperCase()})}/></FormField>
        <FormField label="المبلغ" required><Input inputMode="decimal" required value={budget.amount} onChange={e=>setBudget({...budget,amount:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>إنشاء الموازنة</Button>
      </form></Card>
    </div>
    <div className="ui-grid-md">
      <Card title="إدارة مركز موجود"><FormField label="معرّف مركز التكلفة"><Input value={lookup} onChange={e=>setLookup(e.target.value)}/></FormField><ActionBar>
        <Button disabled={!lookup||a.busy} onClick={()=>void a.run('تم تحميل مركز التكلفة.',()=>api.getCostCenter(lookup))}>عرض</Button>
        <Button variant="danger" disabled={!lookup||a.busy} onClick={()=>void a.run('تم تعطيل مركز التكلفة.',()=>api.deactivateCostCenter(lookup))}>تعطيل</Button>
      </ActionBar></Card>
      <Card title="مراجعة الموازنة"><FormField label="معرّف الموازنة"><Input value={budgetId} onChange={e=>setBudgetId(e.target.value)}/></FormField><ActionBar>
        <Button disabled={!budgetId||a.busy} onClick={()=>void a.run('تم فحص الموازنة.',()=>api.checkBudget(budgetId))}>فحص الفعلي والمتبقي</Button>
        <Button variant="secondary" disabled={!budgetId||a.busy} onClick={()=>void a.run('تم اعتماد الموازنة.',()=>api.authorizeBudget(budgetId))}>اعتماد</Button>
      </ActionBar></Card>
    </div>
    <ResultCard title="آخر نتيجة" value={a.result}/>
  </div>;
}

function PartyAccountingSection(){
  const a=useAction();
  const[group,setGroup]=useState({id:'',name:'',customerPartyId:'',supplierPartyId:''});
  const[net,setNet]=useState({id:'',groupId:'',customerInvoiceId:'',supplierInvoiceId:'',amount:'',postingDate:today(),number:'',approvalRequestId:''});
  const[actionId,setActionId]=useState('');
  const[reverse,setReverse]=useState({postingDate:today(),number:''});
  return <div className="ui-page-stack">
    {a.notice?<Toast tone={a.notice.startsWith('تم')?'success':'error'}>{a.notice}</Toast>:null}
    <div className="ui-grid-md">
      <Card title="مجموعة أطراف للمقاصة"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();const id=group.id||crypto.randomUUID();void a.run('تم إنشاء مجموعة الأطراف.',()=>api.createPartyGroup({id,name:group.name,members:[{id:id+':customer',role:'CUSTOMER',partyId:group.customerPartyId},{id:id+':supplier',role:'SUPPLIER',partyId:group.supplierPartyId}]}))}}>
        <FormField label="اسم المجموعة" required><Input required value={group.name} onChange={e=>setGroup({...group,name:e.target.value})}/></FormField>
        <FormField label="Party ID للعميل" required><Input required value={group.customerPartyId} onChange={e=>setGroup({...group,customerPartyId:e.target.value})}/></FormField>
        <FormField label="Party ID للمورد" required><Input required value={group.supplierPartyId} onChange={e=>setGroup({...group,supplierPartyId:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>إنشاء المجموعة</Button>
      </form></Card>
      <Card title="اقتراح مقاصة"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم تسجيل المقاصة المقترحة.',()=>api.proposeNetting({...net,id:net.id||crypto.randomUUID(),...(net.approvalRequestId?{approvalRequestId:net.approvalRequestId}:{})}))}}>
        <FormField label="مجموعة الأطراف" required><Input required value={net.groupId} onChange={e=>setNet({...net,groupId:e.target.value})}/></FormField>
        <FormField label="فاتورة العميل" required><Input required value={net.customerInvoiceId} onChange={e=>setNet({...net,customerInvoiceId:e.target.value})}/></FormField>
        <FormField label="فاتورة المورد" required><Input required value={net.supplierInvoiceId} onChange={e=>setNet({...net,supplierInvoiceId:e.target.value})}/></FormField>
        <FormField label="المبلغ" required><Input required inputMode="decimal" value={net.amount} onChange={e=>setNet({...net,amount:e.target.value})}/></FormField>
        <FormField label="التاريخ" required><Input required type="date" value={net.postingDate} onChange={e=>setNet({...net,postingDate:e.target.value})}/></FormField>
        <FormField label="رقم المستند" required><Input required value={net.number} onChange={e=>setNet({...net,number:e.target.value})}/></FormField>
        <FormField label="طلب الاعتماد"><Input value={net.approvalRequestId} onChange={e=>setNet({...net,approvalRequestId:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>حفظ المقاصة</Button>
      </form></Card>
    </div>
    <Card title="تنفيذ / عكس المقاصة"><FormField label="معرّف المقاصة"><Input value={actionId} onChange={e=>setActionId(e.target.value)}/></FormField><div className="ui-filter-grid">
      <FormField label="تاريخ العكس"><Input type="date" value={reverse.postingDate} onChange={e=>setReverse({...reverse,postingDate:e.target.value})}/></FormField>
      <FormField label="رقم قيد العكس"><Input value={reverse.number} onChange={e=>setReverse({...reverse,number:e.target.value})}/></FormField>
    </div><ActionBar><Button disabled={!actionId||a.busy} onClick={()=>void a.run('تم تنفيذ المقاصة.',()=>api.executeNetting(actionId))}>تنفيذ</Button><Button variant="danger" disabled={!actionId||!reverse.number||a.busy} onClick={()=>void a.run('تم عكس المقاصة.',()=>api.reverseNetting(actionId,reverse))}>عكس المقاصة</Button></ActionBar></Card>
    <ResultCard title="آخر نتيجة" value={a.result}/>
  </div>;
}

function EcrSection(){
  const a=useAction();
  const[expense,setExpense]=useState({id:'',form:'DIRECT_PAID' as 'DIRECT_PAID'|'SUPPLIER_PAYABLE'|'PREPAID'|'CANCELLATION_PENALTY',sourceType:'MANUAL_EXPENSE',sourceId:'',currency:'EGP',amount:'',baseAmount:'',expenseAccountId:'',prepaidAccountId:'',billingInvoiceId:'',approvalRequestId:''});
  const[pay,setPay]=useState({expenseId:'',treasuryId:'',paymentCurrency:'EGP',postingDate:today(),number:''});
  const[claim,setClaim]=useState({id:'',agentPartyId:'',sourceType:'AGENT_COMMISSION',sourceId:'',currency:'EGP',amount:'',baseCarryingAmount:'',expenseAccountId:'',liabilityAccountId:'',approvalRequestId:''});
  const[claimAction,setClaimAction]=useState({claimId:'',postingDate:today(),number:'',treasuryId:'',paymentId:'',amount:'',paymentCurrency:'EGP'});
  return <div className="ui-page-stack">
    {a.notice?<Toast tone={a.notice.startsWith('تم')?'success':'error'}>{a.notice}</Toast>:null}
    <div className="ui-grid-md">
      <Card title="مصروف / استحقاق"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم إنشاء سجل المصروف.',()=>api.createExpense({...expense,id:expense.id||crypto.randomUUID(),baseAmount:expense.baseAmount||expense.amount,...(expense.expenseAccountId?{expenseAccountId:expense.expenseAccountId}:{}),...(expense.prepaidAccountId?{prepaidAccountId:expense.prepaidAccountId}:{}),...(expense.billingInvoiceId?{billingInvoiceId:expense.billingInvoiceId}:{}),...(expense.approvalRequestId?{approvalRequestId:expense.approvalRequestId}:{})}))}}>
        <FormField label="النوع"><Select value={expense.form} onChange={e=>setExpense({...expense,form:e.target.value as typeof expense.form})}><option value="DIRECT_PAID">مصروف مدفوع مباشرة</option><option value="SUPPLIER_PAYABLE">مستحق لمورد</option><option value="PREPAID">مصروف مقدم</option><option value="CANCELLATION_PENALTY">غرامة إلغاء</option></Select></FormField>
        <FormField label="مرجع المصدر" required><Input required value={expense.sourceId} onChange={e=>setExpense({...expense,sourceId:e.target.value})}/></FormField>
        <FormField label="العملة"><Input value={expense.currency} onChange={e=>setExpense({...expense,currency:e.target.value.toUpperCase()})}/></FormField>
        <FormField label="المبلغ" required><Input required inputMode="decimal" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})}/></FormField>
        <FormField label="القيمة بالعملة الأساسية"><Input inputMode="decimal" value={expense.baseAmount} onChange={e=>setExpense({...expense,baseAmount:e.target.value})}/></FormField>
        <FormField label="حساب المصروف"><Input value={expense.expenseAccountId} onChange={e=>setExpense({...expense,expenseAccountId:e.target.value})}/></FormField>
        <FormField label="حساب المقدم"><Input value={expense.prepaidAccountId} onChange={e=>setExpense({...expense,prepaidAccountId:e.target.value})}/></FormField>
        <FormField label="فاتورة المورد"><Input value={expense.billingInvoiceId} onChange={e=>setExpense({...expense,billingInvoiceId:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>حفظ المصروف</Button>
      </form></Card>
      <Card title="دفع مصروف مباشر"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم دفع المصروف.',()=>api.payExpense(pay.expenseId,{treasuryId:pay.treasuryId,paymentCurrency:pay.paymentCurrency,postingDate:pay.postingDate,number:pay.number}))}}>
        <FormField label="معرّف المصروف" required><Input required value={pay.expenseId} onChange={e=>setPay({...pay,expenseId:e.target.value})}/></FormField>
        <FormField label="الخزينة / البنك" required><Input required value={pay.treasuryId} onChange={e=>setPay({...pay,treasuryId:e.target.value})}/></FormField>
        <FormField label="عملة السداد"><Input value={pay.paymentCurrency} onChange={e=>setPay({...pay,paymentCurrency:e.target.value.toUpperCase()})}/></FormField>
        <FormField label="التاريخ"><Input type="date" value={pay.postingDate} onChange={e=>setPay({...pay,postingDate:e.target.value})}/></FormField>
        <FormField label="رقم المستند"><Input value={pay.number} onChange={e=>setPay({...pay,number:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>ترحيل السداد</Button>
      </form></Card>
    </div>
    <div className="ui-grid-md">
      <Card title="مطالبة عمولة"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم إنشاء مطالبة العمولة.',()=>api.createCommission({...claim,id:claim.id||crypto.randomUUID(),baseCarryingAmount:claim.baseCarryingAmount||claim.amount,...(claim.approvalRequestId?{approvalRequestId:claim.approvalRequestId}:{})}))}}>
        <FormField label="Party ID للوكيل" required><Input required value={claim.agentPartyId} onChange={e=>setClaim({...claim,agentPartyId:e.target.value})}/></FormField>
        <FormField label="مرجع المصدر" required><Input required value={claim.sourceId} onChange={e=>setClaim({...claim,sourceId:e.target.value})}/></FormField>
        <FormField label="المبلغ" required><Input required inputMode="decimal" value={claim.amount} onChange={e=>setClaim({...claim,amount:e.target.value})}/></FormField>
        <FormField label="حساب مصروف العمولة" required><Input required value={claim.expenseAccountId} onChange={e=>setClaim({...claim,expenseAccountId:e.target.value})}/></FormField>
        <FormField label="حساب التزام العمولة" required><Input required value={claim.liabilityAccountId} onChange={e=>setClaim({...claim,liabilityAccountId:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>إنشاء المطالبة</Button>
      </form></Card>
      <Card title="اعتماد / دفع العمولة"><div className="ui-filter-grid">
        <FormField label="معرّف المطالبة"><Input value={claimAction.claimId} onChange={e=>setClaimAction({...claimAction,claimId:e.target.value})}/></FormField>
        <FormField label="التاريخ"><Input type="date" value={claimAction.postingDate} onChange={e=>setClaimAction({...claimAction,postingDate:e.target.value})}/></FormField>
        <FormField label="رقم المستند"><Input value={claimAction.number} onChange={e=>setClaimAction({...claimAction,number:e.target.value})}/></FormField>
        <FormField label="الخزينة / البنك"><Input value={claimAction.treasuryId} onChange={e=>setClaimAction({...claimAction,treasuryId:e.target.value})}/></FormField>
        <FormField label="المبلغ المدفوع"><Input inputMode="decimal" value={claimAction.amount} onChange={e=>setClaimAction({...claimAction,amount:e.target.value})}/></FormField>
      </div><ActionBar>
        <Button disabled={!claimAction.claimId||!claimAction.number||a.busy} onClick={()=>void a.run('تم اعتماد العمولة.',()=>api.approveCommission(claimAction.claimId,{postingDate:claimAction.postingDate,number:claimAction.number}))}>اعتماد</Button>
        <Button variant="secondary" disabled={!claimAction.claimId||!claimAction.treasuryId||!claimAction.amount||a.busy} onClick={()=>void a.run('تم تسجيل دفعة العمولة.',()=>api.payCommission(claimAction.claimId,{paymentId:claimAction.paymentId||crypto.randomUUID(),treasuryId:claimAction.treasuryId,amount:claimAction.amount,paymentCurrency:claimAction.paymentCurrency,postingDate:claimAction.postingDate,number:claimAction.number}))}>دفع</Button>
      </ActionBar></Card>
    </div>
    <ResultCard title="آخر نتيجة" value={a.result}/>
  </div>;
}

function AssetsFinancingSection(){
  const a=useAction();
  const[asset,setAsset]=useState({id:'',code:'',name:'',acquisitionValue:'',baseValue:'',currency:'EGP',acquisitionDate:today(),capitalizationDate:today(),inServiceDate:today(),residualValue:'0',usefulLifeMonths:'36',assetAccountId:'',capitalizationOffsetAccountId:'',accumulatedDepreciationAccountId:'',depreciationExpenseAccountId:'',number:''});
  const[dep,setDep]=useState({assetId:'',movementId:'',period:'1',postingDate:today(),number:''});
  const[loan,setLoan]=useState({id:'',lenderId:'',reference:'',principal:'',currency:'EGP',baseAmount:'',liabilityAccountId:'',interestExpenseAccountId:'',fundingTreasuryId:'',postingDate:today(),number:'',installmentId:'',dueDate:today(),interest:'0'});
  const[pay,setPay]=useState({loanId:'',installmentId:'',treasuryId:'',postingDate:today(),number:''});
  return <div className="ui-page-stack">
    {a.notice?<Toast tone={a.notice.startsWith('تم')?'success':'error'}>{a.notice}</Toast>:null}
    <Card title="تسجيل أصل ثابت"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم تسجيل الأصل وترحيل رسملته.',()=>api.registerAsset({...asset,id:asset.id||crypto.randomUUID(),baseValue:asset.baseValue||asset.acquisitionValue,usefulLifeMonths:Number(asset.usefulLifeMonths)}))}}>
      <FormField label="كود الأصل" required><Input required value={asset.code} onChange={e=>setAsset({...asset,code:e.target.value.toUpperCase()})}/></FormField>
      <FormField label="اسم الأصل" required><Input required value={asset.name} onChange={e=>setAsset({...asset,name:e.target.value})}/></FormField>
      <FormField label="قيمة الاقتناء" required><Input required inputMode="decimal" value={asset.acquisitionValue} onChange={e=>setAsset({...asset,acquisitionValue:e.target.value})}/></FormField>
      <FormField label="العملة الأساسية" required><Input required maxLength={3} value={asset.currency} onChange={e=>setAsset({...asset,currency:e.target.value.toUpperCase()})}/></FormField>
      <FormField label="القيمة الأساسية"><Input inputMode="decimal" value={asset.baseValue} onChange={e=>setAsset({...asset,baseValue:e.target.value})}/></FormField>
      <FormField label="القيمة التخريدية"><Input inputMode="decimal" value={asset.residualValue} onChange={e=>setAsset({...asset,residualValue:e.target.value})}/></FormField>
      <FormField label="العمر بالشهور"><Input type="number" min="1" value={asset.usefulLifeMonths} onChange={e=>setAsset({...asset,usefulLifeMonths:e.target.value})}/></FormField>
      <FormField label="تاريخ الاقتناء"><Input type="date" value={asset.acquisitionDate} onChange={e=>setAsset({...asset,acquisitionDate:e.target.value})}/></FormField>
      <FormField label="تاريخ الرسملة"><Input type="date" value={asset.capitalizationDate} onChange={e=>setAsset({...asset,capitalizationDate:e.target.value})}/></FormField>
      <FormField label="تاريخ التشغيل"><Input type="date" value={asset.inServiceDate} onChange={e=>setAsset({...asset,inServiceDate:e.target.value})}/></FormField>
      <FormField label="حساب الأصل" required><Input required value={asset.assetAccountId} onChange={e=>setAsset({...asset,assetAccountId:e.target.value})}/></FormField>
      <FormField label="حساب مقابل الرسملة" required><Input required value={asset.capitalizationOffsetAccountId} onChange={e=>setAsset({...asset,capitalizationOffsetAccountId:e.target.value})}/></FormField>
      <FormField label="مجمع الإهلاك" required><Input required value={asset.accumulatedDepreciationAccountId} onChange={e=>setAsset({...asset,accumulatedDepreciationAccountId:e.target.value})}/></FormField>
      <FormField label="مصروف الإهلاك" required><Input required value={asset.depreciationExpenseAccountId} onChange={e=>setAsset({...asset,depreciationExpenseAccountId:e.target.value})}/></FormField>
      <FormField label="رقم قيد الرسملة" required><Input required value={asset.number} onChange={e=>setAsset({...asset,number:e.target.value})}/></FormField>
      <Button type="submit" loading={a.busy}>تسجيل الأصل</Button>
    </form></Card>
    <div className="ui-grid-md">
      <Card title="ترحيل إهلاك"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم ترحيل الإهلاك.',()=>api.depreciateAsset(dep.assetId,{movementId:dep.movementId||crypto.randomUUID(),period:Number(dep.period),postingDate:dep.postingDate,number:dep.number}))}}>
        <FormField label="معرّف الأصل" required><Input required value={dep.assetId} onChange={e=>setDep({...dep,assetId:e.target.value})}/></FormField>
        <FormField label="رقم الفترة" required><Input type="number" min="1" value={dep.period} onChange={e=>setDep({...dep,period:e.target.value})}/></FormField>
        <FormField label="التاريخ" required><Input type="date" value={dep.postingDate} onChange={e=>setDep({...dep,postingDate:e.target.value})}/></FormField>
        <FormField label="رقم القيد" required><Input value={dep.number} onChange={e=>setDep({...dep,number:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>ترحيل الإهلاك</Button>
      </form></Card>
      <Card title="إنشاء قرض"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();const id=loan.id||crypto.randomUUID();void a.run('تم إنشاء القرض وتمويله.',()=>api.originateLoan({id,lenderId:loan.lenderId,reference:loan.reference,principal:loan.principal,currency:loan.currency,baseAmount:loan.baseAmount||loan.principal,liabilityAccountId:loan.liabilityAccountId,interestExpenseAccountId:loan.interestExpenseAccountId,fundingTreasuryId:loan.fundingTreasuryId,postingDate:loan.postingDate,number:loan.number,installments:[{id:loan.installmentId||id+':1',dueDate:loan.dueDate,principal:loan.principal,interest:loan.interest}]}))}}>
        <FormField label="المُقرض" required><Input required value={loan.lenderId} onChange={e=>setLoan({...loan,lenderId:e.target.value})}/></FormField>
        <FormField label="مرجع القرض" required><Input required value={loan.reference} onChange={e=>setLoan({...loan,reference:e.target.value})}/></FormField>
        <FormField label="أصل القرض" required><Input required inputMode="decimal" value={loan.principal} onChange={e=>setLoan({...loan,principal:e.target.value})}/></FormField>
        <FormField label="العملة الأساسية" required><Input required maxLength={3} value={loan.currency} onChange={e=>setLoan({...loan,currency:e.target.value.toUpperCase()})}/></FormField>
        <FormField label="فائدة أول قسط"><Input inputMode="decimal" value={loan.interest} onChange={e=>setLoan({...loan,interest:e.target.value})}/></FormField>
        <FormField label="استحقاق أول قسط"><Input type="date" value={loan.dueDate} onChange={e=>setLoan({...loan,dueDate:e.target.value})}/></FormField>
        <FormField label="حساب التزام القرض" required><Input required value={loan.liabilityAccountId} onChange={e=>setLoan({...loan,liabilityAccountId:e.target.value})}/></FormField>
        <FormField label="حساب مصروف الفائدة" required><Input required value={loan.interestExpenseAccountId} onChange={e=>setLoan({...loan,interestExpenseAccountId:e.target.value})}/></FormField>
        <FormField label="خزينة التمويل" required><Input required value={loan.fundingTreasuryId} onChange={e=>setLoan({...loan,fundingTreasuryId:e.target.value})}/></FormField>
        <FormField label="رقم مستند التمويل" required><Input required value={loan.number} onChange={e=>setLoan({...loan,number:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>إنشاء القرض</Button>
      </form></Card>
    </div>
    <Card title="سداد قسط قرض"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم سداد القسط.',()=>api.payLoanInstallment(pay.loanId,pay.installmentId,{treasuryId:pay.treasuryId,postingDate:pay.postingDate,number:pay.number}))}}>
      <FormField label="معرّف القرض" required><Input required value={pay.loanId} onChange={e=>setPay({...pay,loanId:e.target.value})}/></FormField>
      <FormField label="معرّف القسط" required><Input required value={pay.installmentId} onChange={e=>setPay({...pay,installmentId:e.target.value})}/></FormField>
      <FormField label="الخزينة / البنك" required><Input required value={pay.treasuryId} onChange={e=>setPay({...pay,treasuryId:e.target.value})}/></FormField>
      <FormField label="التاريخ"><Input type="date" value={pay.postingDate} onChange={e=>setPay({...pay,postingDate:e.target.value})}/></FormField>
      <FormField label="رقم المستند" required><Input required value={pay.number} onChange={e=>setPay({...pay,number:e.target.value})}/></FormField>
      <Button type="submit" loading={a.busy}>سداد القسط</Button>
    </form></Card>
    <ResultCard title="آخر نتيجة" value={a.result}/>
  </div>;
}

const inventoryTabs=[{id:'contracts',label:'العقود'},{id:'resources',label:'السعات والمخزون'},{id:'allocations',label:'التخصيص والإتاحة'}];
export function ContractInventoryPage(){
  const[tab,setTab]=useState('contracts');
  return <section dir="rtl" className="ui-page-stack">
    <PageHeader eyebrow="السياحة والحج والعمرة" title="التعاقدات والمخزون" description="إدارة العقود والسعات والتخصيصات من المصدر المشترك المعتمد بدون إنشاء مخزون موازٍ."/>
    <div className="ui-metric-grid"><MetricCard label="المالك" value="Tourism Contract Inventory"/><MetricCard label="النطاق" value="فنادق · طيران · نقل · تأشيرات · خدمات"/><MetricCard label="المشاركة" value="السياحة + الحج والعمرة"/></div>
    <Tabs tabs={inventoryTabs} active={tab} onChange={setTab}/>
    {tab==='contracts'?<ContractsSection/>:tab==='resources'?<ResourcesSection/>:<AllocationsSection/>}
  </section>;
}

function ContractsSection(){
  const a=useAction();
  const[form,setForm]=useState({type:'HOTEL' as ContractType,supplierId:'',effectiveFrom:today(),effectiveTo:today(),sourceType:'',sourceId:''});
  const[lookup,setLookup]=useState('');
  const[amend,setAmend]=useState({effectiveFrom:today(),effectiveTo:'',terms:'{}'});
  const[data,setData]=useState<{contract:JsonRecord|null;versions:JsonRecord[]}|null>(null);
  async function load(){if(!lookup)return;await a.run('تم تحميل العقد.',async()=>{const v=await api.getContract(lookup);setData(v);return v.contract??{};});}
  return <div className="ui-page-stack">
    {a.notice?<Toast tone={a.notice.startsWith('تم')?'success':'error'}>{a.notice}</Toast>:null}
    <div className="ui-grid-md">
      <Card title="عقد جديد"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم إنشاء العقد.',()=>api.createContract({...form,...(form.supplierId?{supplierId:form.supplierId}:{}),...(form.sourceType&&form.sourceId?{sourceType:form.sourceType,sourceId:form.sourceId}:{})}))}}>
        <FormField label="نوع العقد"><Select value={form.type} onChange={e=>setForm({...form,type:e.target.value as ContractType})}><option value="HOTEL">فندق</option><option value="FLIGHT_BLOCK">بلوك طيران</option><option value="TRANSPORT">نقل</option><option value="VISA">تأشيرات</option><option value="SERVICE">خدمة</option></Select></FormField>
        <FormField label="المورد"><Input value={form.supplierId} onChange={e=>setForm({...form,supplierId:e.target.value})}/></FormField>
        <FormField label="ساري من"><Input type="date" value={form.effectiveFrom} onChange={e=>setForm({...form,effectiveFrom:e.target.value})}/></FormField>
        <FormField label="ساري إلى"><Input type="date" value={form.effectiveTo} onChange={e=>setForm({...form,effectiveTo:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>إنشاء العقد</Button>
      </form></Card>
      <Card title="فتح عقد"><FormField label="معرّف العقد"><Input value={lookup} onChange={e=>setLookup(e.target.value)}/></FormField><ActionBar><Button disabled={!lookup||a.busy} onClick={()=>void load()}>عرض العقد</Button></ActionBar>
        {data?.contract?<ResultCard title="بيانات العقد" value={data.contract}/>:null}
      </Card>
    </div>
    {lookup?<Card title="إصدار / تعديل شروط العقد"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();let terms:Record<string,unknown>;try{terms=JSON.parse(amend.terms) as Record<string,unknown>;}catch{void a.run('تعذر تنفيذ العملية.',async()=>{throw new Error('شروط العقد يجب أن تكون JSON صالحًا.');});return;}void a.run('تم إنشاء إصدار جديد للعقد.',()=>api.amendContract(lookup,{terms,effectiveFrom:amend.effectiveFrom,...(amend.effectiveTo?{effectiveTo:amend.effectiveTo}:{})}))}}>
      <FormField label="ساري من"><Input type="date" value={amend.effectiveFrom} onChange={e=>setAmend({...amend,effectiveFrom:e.target.value})}/></FormField>
      <FormField label="ساري إلى"><Input type="date" value={amend.effectiveTo} onChange={e=>setAmend({...amend,effectiveTo:e.target.value})}/></FormField>
      <FormField label="شروط الإصدار" hint='مثال: {"meal":"HB","releaseDays":7}'><Textarea value={amend.terms} onChange={e=>setAmend({...amend,terms:e.target.value})}/></FormField>
      <Button type="submit" loading={a.busy}>حفظ إصدار جديد</Button>
    </form>{data?.versions.length?<DataGrid columns={['الإصدار','ساري من','ساري إلى','الحالي']}>{data.versions.map((v,index)=><tr key={String(v.id??index)}><td>{valueText(v.versionNumber)}</td><td>{valueText(v.effectiveFrom)}</td><td>{valueText(v.effectiveTo)}</td><td>{v.isCurrent?'نعم':'لا'}</td></tr>)}</DataGrid>:null}</Card>:null}
  </div>;
}

function ResourcesSection(){
  const a=useAction();
  const[kind,setKind]=useState<'HOTEL'|'FLIGHT'|'TRANSPORT'|'VISA'|'SERVICE'>('HOTEL');
  const[f,setF]=useState<Record<string,string>>({contractId:'',hotelId:'',roomId:'',serviceDate:today(),contractedQuantity:'',flightNumber:'',origin:'',destination:'',departureDate:today(),totalSeats:'',vehicleId:'',capacityUnits:'',periodStart:today(),periodEnd:today(),visaType:'',nationality:'',quotaTotal:'',effectiveFrom:today(),effectiveTo:today(),category:'OTHER',name:'',description:'',unit:'',serviceStart:today(),serviceEnd:today(),capacity:'',releaseDeadline:''});
  const field=(key:string)=>f[key]??'',set=(key:string,value:string)=>setF({...f,[key]:value});
  async function submit(e:FormEvent){e.preventDefault();const payload:JsonRecord={kind,contractId:field('contractId')};
    if(kind==='HOTEL')Object.assign(payload,{hotelId:field('hotelId'),roomId:field('roomId')||undefined,serviceDate:field('serviceDate'),contractedQuantity:field('contractedQuantity')});
    if(kind==='FLIGHT')Object.assign(payload,{flightNumber:field('flightNumber'),origin:field('origin'),destination:field('destination'),departureDate:field('departureDate'),totalSeats:field('totalSeats')});
    if(kind==='TRANSPORT')Object.assign(payload,{vehicleId:field('vehicleId'),capacityUnits:field('capacityUnits'),periodStart:field('periodStart'),periodEnd:field('periodEnd')});
    if(kind==='VISA')Object.assign(payload,{visaType:field('visaType'),nationality:field('nationality')||undefined,quotaTotal:field('quotaTotal'),effectiveFrom:field('effectiveFrom'),effectiveTo:field('effectiveTo')});
    if(kind==='SERVICE')Object.assign(payload,{category:field('category') as ServiceCategory,name:field('name'),description:field('description')||undefined,unit:field('unit'),serviceStart:field('serviceStart'),serviceEnd:field('serviceEnd'),capacity:field('capacity'),releaseDeadline:field('releaseDeadline')||undefined});
    await a.run('تمت إضافة السعة إلى المخزون.',()=>api.createResource(payload));
  }
  return <div className="ui-page-stack">
    {a.notice?<Toast tone={a.notice.startsWith('تم')?'success':'error'}>{a.notice}</Toast>:null}
    <Card title="إضافة سعة / مخزون"><form className="ui-filter-grid" onSubmit={e=>void submit(e)}>
      <FormField label="العقد" required><Input required value={field('contractId')} onChange={e=>set('contractId',e.target.value)}/></FormField>
      <FormField label="نوع المخزون"><Select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="HOTEL">غرف فندق</option><option value="FLIGHT">بلوك طيران</option><option value="TRANSPORT">سعة نقل</option><option value="VISA">حصة تأشيرات</option><option value="SERVICE">خدمة عامة</option></Select></FormField>
      {kind==='HOTEL'?<><FormField label="الفندق" required><Input required value={field('hotelId')} onChange={e=>set('hotelId',e.target.value)}/></FormField><FormField label="نوع/غرفة"><Input value={field('roomId')} onChange={e=>set('roomId',e.target.value)}/></FormField><FormField label="التاريخ"><Input type="date" value={field('serviceDate')} onChange={e=>set('serviceDate',e.target.value)}/></FormField><FormField label="الكمية المتعاقد عليها"><Input inputMode="decimal" required value={field('contractedQuantity')} onChange={e=>set('contractedQuantity',e.target.value)}/></FormField></>:null}
      {kind==='FLIGHT'?<><FormField label="رقم الرحلة"><Input required value={field('flightNumber')} onChange={e=>set('flightNumber',e.target.value)}/></FormField><FormField label="من"><Input required value={field('origin')} onChange={e=>set('origin',e.target.value)}/></FormField><FormField label="إلى"><Input required value={field('destination')} onChange={e=>set('destination',e.target.value)}/></FormField><FormField label="تاريخ المغادرة"><Input type="date" value={field('departureDate')} onChange={e=>set('departureDate',e.target.value)}/></FormField><FormField label="المقاعد"><Input inputMode="decimal" required value={field('totalSeats')} onChange={e=>set('totalSeats',e.target.value)}/></FormField></>:null}
      {kind==='TRANSPORT'?<><FormField label="المركبة"><Input required value={field('vehicleId')} onChange={e=>set('vehicleId',e.target.value)}/></FormField><FormField label="السعة"><Input inputMode="decimal" required value={field('capacityUnits')} onChange={e=>set('capacityUnits',e.target.value)}/></FormField><FormField label="من"><Input type="date" value={field('periodStart')} onChange={e=>set('periodStart',e.target.value)}/></FormField><FormField label="إلى"><Input type="date" value={field('periodEnd')} onChange={e=>set('periodEnd',e.target.value)}/></FormField></>:null}
      {kind==='VISA'?<><FormField label="نوع التأشيرة"><Input required value={field('visaType')} onChange={e=>set('visaType',e.target.value)}/></FormField><FormField label="الجنسية"><Input value={field('nationality')} onChange={e=>set('nationality',e.target.value)}/></FormField><FormField label="الحصة"><Input inputMode="decimal" required value={field('quotaTotal')} onChange={e=>set('quotaTotal',e.target.value)}/></FormField><FormField label="ساري من"><Input type="date" value={field('effectiveFrom')} onChange={e=>set('effectiveFrom',e.target.value)}/></FormField><FormField label="ساري إلى"><Input type="date" value={field('effectiveTo')} onChange={e=>set('effectiveTo',e.target.value)}/></FormField></>:null}
      {kind==='SERVICE'?<><FormField label="الفئة"><Select value={field('category')} onChange={e=>set('category',e.target.value)}>{['CAMP','MEAL','VISIT','GUIDE','RAWDA','INSURANCE','OTHER'].map(x=><option key={x}>{x}</option>)}</Select></FormField><FormField label="اسم الخدمة"><Input required value={field('name')} onChange={e=>set('name',e.target.value)}/></FormField><FormField label="الوحدة"><Input required value={field('unit')} onChange={e=>set('unit',e.target.value)}/></FormField><FormField label="السعة"><Input inputMode="decimal" required value={field('capacity')} onChange={e=>set('capacity',e.target.value)}/></FormField><FormField label="بداية الخدمة"><Input type="date" value={field('serviceStart')} onChange={e=>set('serviceStart',e.target.value)}/></FormField><FormField label="نهاية الخدمة"><Input type="date" value={field('serviceEnd')} onChange={e=>set('serviceEnd',e.target.value)}/></FormField></>:null}
      <Button type="submit" loading={a.busy}>إضافة للمخزون</Button>
    </form></Card>
    <ResultCard title="السعة المضافة" value={a.result}/>
  </div>;
}

function AllocationsSection(){
  const a=useAction();
  const[availability,setAvailability]=useState({contractId:'',resourceType:'HOTEL' as ContractType,resourceId:'',serviceDate:today(),periodEnd:''});
  const[allocation,setAllocation]=useState({contractId:'',resourceType:'HOTEL' as ContractType,resourceId:'',programSourceType:'PROGRAM',programSourceId:'',serviceDate:today(),periodEnd:'',quantity:''});
  const[stopSale,setStopSale]=useState({contractId:'',reason:'',effectiveFrom:today(),effectiveTo:today()});
  const[lookup,setLookup]=useState(''),[release,setRelease]=useState('');
  return <div className="ui-page-stack">
    {a.notice?<Toast tone={a.notice.startsWith('تم')?'success':'error'}>{a.notice}</Toast>:null}
    <div className="ui-grid-md">
      <Card title="فحص الإتاحة"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم فحص الإتاحة.',()=>api.availability({...availability,...(availability.periodEnd?{periodEnd:availability.periodEnd}:{})}))}}>
        <FormField label="العقد" required><Input required value={availability.contractId} onChange={e=>setAvailability({...availability,contractId:e.target.value})}/></FormField>
        <FormField label="النوع"><Select value={availability.resourceType} onChange={e=>setAvailability({...availability,resourceType:e.target.value as ContractType})}><option value="HOTEL">فندق</option><option value="FLIGHT_BLOCK">طيران</option><option value="TRANSPORT">نقل</option><option value="VISA">تأشيرة</option><option value="SERVICE">خدمة</option></Select></FormField>
        <FormField label="معرّف السعة" required><Input required value={availability.resourceId} onChange={e=>setAvailability({...availability,resourceId:e.target.value})}/></FormField>
        <FormField label="تاريخ الخدمة"><Input type="date" value={availability.serviceDate} onChange={e=>setAvailability({...availability,serviceDate:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>فحص</Button>
      </form></Card>
      <Card title="تخصيص سعة لبرنامج"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم تخصيص السعة للبرنامج.',()=>api.allocate({...allocation,...(allocation.periodEnd?{periodEnd:allocation.periodEnd}:{})}))}}>
        <FormField label="العقد" required><Input required value={allocation.contractId} onChange={e=>setAllocation({...allocation,contractId:e.target.value})}/></FormField>
        <FormField label="نوع المورد"><Select value={allocation.resourceType} onChange={e=>setAllocation({...allocation,resourceType:e.target.value as ContractType})}><option value="HOTEL">فندق</option><option value="FLIGHT_BLOCK">طيران</option><option value="TRANSPORT">نقل</option><option value="VISA">تأشيرة</option><option value="SERVICE">خدمة</option></Select></FormField>
        <FormField label="معرّف السعة" required><Input required value={allocation.resourceId} onChange={e=>setAllocation({...allocation,resourceId:e.target.value})}/></FormField>
        <FormField label="معرّف البرنامج" required><Input required value={allocation.programSourceId} onChange={e=>setAllocation({...allocation,programSourceId:e.target.value})}/></FormField>
        <FormField label="تاريخ الخدمة"><Input type="date" value={allocation.serviceDate} onChange={e=>setAllocation({...allocation,serviceDate:e.target.value})}/></FormField>
        <FormField label="الكمية" required><Input inputMode="decimal" required value={allocation.quantity} onChange={e=>setAllocation({...allocation,quantity:e.target.value})}/></FormField>
        <Button type="submit" loading={a.busy}>تخصيص</Button>
      </form></Card>
    </div>
    <Card title="إيقاف بيع على عقد"><form className="ui-filter-grid" onSubmit={e=>{e.preventDefault();void a.run('تم تسجيل إيقاف البيع على العقد.',()=>api.createStopSale(stopSale))}}>
      <FormField label="العقد" required><Input required value={stopSale.contractId} onChange={e=>setStopSale({...stopSale,contractId:e.target.value})}/></FormField>
      <FormField label="سبب الإيقاف" required><Input required value={stopSale.reason} onChange={e=>setStopSale({...stopSale,reason:e.target.value})}/></FormField>
      <FormField label="ساري من" required><Input required type="date" value={stopSale.effectiveFrom} onChange={e=>setStopSale({...stopSale,effectiveFrom:e.target.value})}/></FormField>
      <FormField label="ساري إلى" required><Input required type="date" value={stopSale.effectiveTo} onChange={e=>setStopSale({...stopSale,effectiveTo:e.target.value})}/></FormField>
      <Button type="submit" loading={a.busy}>تسجيل إيقاف البيع</Button>
    </form></Card>
    <Card title="متابعة تخصيص"><div className="ui-filter-grid"><FormField label="معرّف التخصيص"><Input value={lookup} onChange={e=>setLookup(e.target.value)}/></FormField><FormField label="كمية التحرير"><Input inputMode="decimal" value={release} onChange={e=>setRelease(e.target.value)}/></FormField></div><ActionBar>
      <Button disabled={!lookup||a.busy} onClick={()=>void a.run('تم تحميل التخصيص.',()=>api.getAllocation(lookup))}>عرض</Button>
      <Button variant="danger" disabled={!lookup||!release||a.busy} onClick={()=>void a.run('تم تنفيذ تحرير السعة وفق موانع المخزون.',()=>api.releaseAllocation(lookup,release))}>تحرير سعة</Button>
    </ActionBar></Card>
    <ResultCard title="آخر نتيجة" value={a.result}/>
  </div>;
}
