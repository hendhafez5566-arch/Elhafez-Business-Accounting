import { useEffect, useMemo, useState } from 'react';
import { Checkbox, FormField, Select } from './ui.js';
import { tourismServicesApi, type DraftInput, type SupplierReference, type TravelerReference } from './tourism-services-client.js';

type Props={value:DraftInput;onChange:(value:DraftInput)=>void};
const ids=(value:unknown):string[]=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[];

export function TourismPartyReferenceFields({value,onChange}:Props){
 const[customers,setCustomers]=useState<Awaited<ReturnType<typeof tourismServicesApi.customers>>>([]),[agents,setAgents]=useState<Awaited<ReturnType<typeof tourismServicesApi.agents>>>([]),[travelers,setTravelers]=useState<TravelerReference[]>([]),[warning,setWarning]=useState('');
 useEffect(()=>{let active=true;void Promise.allSettled([tourismServicesApi.customers(),tourismServicesApi.agents(),tourismServicesApi.travelers()]).then(results=>{if(!active)return;setCustomers(results[0].status==='fulfilled'?results[0].value:[]);setAgents(results[1].status==='fulfilled'?results[1].value:[]);setTravelers(results[2].status==='fulfilled'?results[2].value:[]);const missing=['العملاء','الوكلاء','المسافرون'].filter((_,index)=>results[index]?.status==='rejected');setWarning(missing.length?`لا يمكن قراءة ${missing.join(' و ')} بالصلاحيات الحالية.`:'');});return()=>{active=false};},[]);
 const selectedTravelerIds=useMemo(()=>new Set(ids(value.details.travelerIds)),[value.details.travelerIds]);
 function customer(partyId:string){onChange({...value,customerPartyId:partyId,debtorPartyId:value.debtorKind==='CUSTOMER'?partyId:value.debtorPartyId});}
 function debtorKind(kind:DraftInput['debtorKind']){onChange({...value,debtorKind:kind,debtorPartyId:kind==='CUSTOMER'?value.customerPartyId:''});}
 function traveler(row:TravelerReference,checked:boolean){const nextIds=new Set(selectedTravelerIds);if(checked)nextIds.add(row.id);else nextIds.delete(row.id);const selected=travelers.filter(item=>nextIds.has(item.id));const beneficiaryPartyIds=[...new Set(selected.map(item=>item.partyId).filter((item):item is string=>Boolean(item)))];onChange({...value,beneficiaryPartyIds,details:{...value.details,travelerIds:[...nextIds]}});}
 return <>
  <FormField label="العميل" required><Select required value={value.customerPartyId} onChange={e=>customer(e.target.value)}><option value="">اختر العميل</option>{customers.map(row=><option key={row.customer.id} value={row.party.id}>{row.customer.number} — {row.party.displayName}</option>)}</Select></FormField>
  <FormField label="الفاتورة على"><Select value={value.debtorKind} onChange={e=>debtorKind(e.target.value as DraftInput['debtorKind'])}><option value="CUSTOMER">العميل</option><option value="AGENT">الوكيل</option></Select></FormField>
  {value.debtorKind==='AGENT'&&<FormField label="الوكيل" required><Select required value={value.debtorPartyId} onChange={e=>onChange({...value,debtorPartyId:e.target.value})}><option value="">اختر الوكيل</option>{agents.map(row=><option key={row.agent.id} value={row.party.id}>{row.agent.number} — {row.party.displayName}</option>)}</Select></FormField>}
  <FormField label="المسافرون"><div>{travelers.length?travelers.map(row=><label className="ui-checkbox-field" key={row.id}><Checkbox checked={selectedTravelerIds.has(row.id)} disabled={!row.partyId} onChange={e=>traveler(row,e.target.checked)}/><span>{row.fullName}{row.partyId?'':' — غير مرتبط بهوية Party'}</span></label>):<span>لا توجد قائمة مسافرين متاحة.</span>}</div></FormField>
  {warning&&<p role="note">{warning}</p>}
 </>;
}

export function TourismSupplierReferenceSelect({value,onChange,allowBlank=true}:{value:string;onChange:(value:string)=>void;allowBlank?:boolean}){
 const[rows,setRows]=useState<SupplierReference[]>([]),[warning,setWarning]=useState('');
 useEffect(()=>{let active=true;void tourismServicesApi.suppliers().then(value=>{if(active)setRows(value.filter(row=>row.supplier.status==='ACTIVE'&&row.supplier.approvalStatus==='APPROVED'));}).catch(()=>{if(active)setWarning('لا يمكن قراءة الموردين بالصلاحيات الحالية.');});return()=>{active=false};},[]);
 return <>{<Select required={!allowBlank} value={value} onChange={e=>onChange(e.target.value)}>{allowBlank&&<option value="">بدون مورد خارجي</option>}{rows.map(row=><option key={row.supplier.id} value={row.party.id}>{row.supplier.supplierCode} — {row.party.displayName}</option>)}</Select>}{warning&&<p role="note">{warning}</p>}</>;
}
