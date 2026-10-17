import {useEffect,useState} from 'react';
import {advancedAccountingApi,type CommissionClaimOption} from './advanced-accounting-client.js';
import type {TreasuryRow} from './accounting-client.js';
import {ActionBar,Button,Card,DataGrid,FormField,Input,Select,Toast} from './ui.js';

export function CommissionClaimsPanel({treasuries}:{readonly treasuries:readonly TreasuryRow[]}){
 const [claims,setClaims]=useState<CommissionClaimOption[]>([]),[selected,setSelected]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [payment,setPayment]=useState({treasuryId:'',amount:'',postingDate:new Date().toISOString().slice(0,10),number:''});
 const claim=claims.find(x=>x.id===selected),treasury=treasuries.find(x=>x.id===payment.treasuryId);
 async function reload(){setClaims(await advancedAccountingApi.commissionClaims());}
 useEffect(()=>{let current=true;void advancedAccountingApi.commissionClaims().then(value=>{if(current)setClaims(value);}).catch(error=>{if(current)setNotice(error instanceof Error?error.message:'تعذر تحميل العمولات');});return()=>{current=false;};},[]);
 async function perform(kind:'approve'|'pay'){
  if(!claim||busy)return;if(!payment.postingDate||!payment.number.trim()){setNotice('أدخل التاريخ ورقم المستند للمراجعة قبل التنفيذ.');return;}
  setBusy(true);setNotice('');try{
   if(kind==='approve')await advancedAccountingApi.approveCommission(claim.id,{postingDate:payment.postingDate,number:payment.number.trim()});
   else{
    if(!treasury||!payment.amount.trim())throw Error('اختر الخزينة وأدخل المبلغ بعملتها.');
    const input={treasuryId:treasury.id,amount:payment.amount.trim(),paymentCurrency:treasury.currency,postingDate:payment.postingDate,number:payment.number.trim()};
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([claim.id,input.number]))),paymentId='commission-ui:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
    await advancedAccountingApi.payCommission(claim.id,{...input,paymentId});
   }
   await reload();setNotice(kind==='approve'?'تم اعتماد مطالبة العمولة وترحيل استحقاقها.':'تم صرف الدفعة وحفظ مرجعها وتاريخها.');
  }catch(error){setNotice(error instanceof Error?error.message:'تعذر تنفيذ العمولة');}finally{setBusy(false);}
 }
 return <section aria-label="استحقاقات العمولات"><Card title="مراجعة وصرف استحقاقات العمولات">
  {notice&&<Toast>{notice}</Toast>}
  <FormField label="مطالبة العمولة"><Select value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);const selectedClaim=claims.find(x=>x.id===e.target.value);if(selectedClaim?.status==='APPROVING'&&selectedClaim.approvalIntent)setPayment(old=>({...old,...selectedClaim.approvalIntent}));}}><option value="">اختر الاستحقاق المحفوظ</option>{claims.map(x=><option key={x.id} value={x.id}>{x.label} — {x.amount} {x.currency} — {x.status}</option>)}</Select></FormField>
  {claim&&<><p>{claim.label} — {claim.amount} {claim.currency} — {claim.status}</p><DataGrid columns={['دفعة محفوظة','عملة الصرف','المبلغ','المسوّى بعملة الاستحقاق','الحالة']}>{claim.payments.map(p=><tr key={p.id}><td>{p.id}</td><td>{p.paymentCurrency}</td><td>{p.amount}</td><td>{p.claimAmountApplied} {claim.currency}</td><td>{p.status}</td></tr>)}</DataGrid></>}
  {claim?.settlement&&<p>تسوية {claim.settlement.number} بتاريخ {claim.settlement.postingDate}: أُلغي من غير المدفوع {claim.settlement.releasedAmount} {claim.settlement.currency}. السبب: {claim.settlement.reason}. تبقى الدفعات السابقة أعلاه محفوظة.</p>}
  <FormField label="خزينة صرف العمولة"><Select disabled={busy} value={payment.treasuryId} onChange={e=>setPayment({...payment,treasuryId:e.target.value})}><option value="">اختر الخزينة والعملة</option>{treasuries.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.name} — {x.currency}</option>)}</Select></FormField>
  <FormField label="مبلغ دفعة العمولة بعملة الخزينة"><Input disabled={busy} inputMode="decimal" value={payment.amount} onChange={e=>setPayment({...payment,amount:e.target.value})}/></FormField>
  <FormField label="تاريخ قيد العمولة"><Input disabled={busy||claim?.status==='APPROVING'} type="date" value={payment.postingDate} onChange={e=>setPayment({...payment,postingDate:e.target.value})}/></FormField>
  <FormField label="رقم مستند العمولة"><Input disabled={busy||claim?.status==='APPROVING'} value={payment.number} onChange={e=>setPayment({...payment,number:e.target.value})}/></FormField>
  <ActionBar><Button disabled={busy||!claim||!['DRAFT','APPROVING'].includes(claim.status)} onClick={()=>void perform('approve')}>{claim?.status==='APPROVING'?'استئناف اعتماد الاستحقاق المختار':'اعتماد الاستحقاق المختار'}</Button><Button disabled={busy||!claim||!['APPROVED','PARTIALLY_PAID'].includes(claim.status)} onClick={()=>void perform('pay')}>صرف دفعة الاستحقاق المختار</Button><Button disabled={busy} variant="secondary" onClick={()=>void reload().catch(error=>setNotice(error instanceof Error?error.message:'تعذر التحديث'))}>تحديث الاستحقاقات</Button></ActionBar>
 </Card></section>;
}
