import{useEffect,useMemo,useState}from'react';
import{crmGet}from'./crm-core-client.js';
import{Checkbox,FormField,Input,LoadingState,Select}from'./ui.js';

export type EntityPickerKind='CUSTOMER'|'AGENT'|'SUPPLIER'|'TRAVELER'|'LEAD'|'HAJJ_PROGRAM'|'TOURISM_PROGRAM'|'ACCOUNT'|'USER';
export interface EntityOption{readonly id:string;readonly label:string;readonly detail?:string}
const endpoint:Record<EntityPickerKind,string>={CUSTOMER:'/crm/customers',AGENT:'/crm/agents',SUPPLIER:'/suppliers',TRAVELER:'/crm/travelers',LEAD:'/crm/leads',HAJJ_PROGRAM:'/hajj-umrah/programs',TOURISM_PROGRAM:'/tourism/programs',ACCOUNT:'/accounting/overview',USER:'/system-administration/users'};
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function text(value:unknown){return typeof value==='string'?value:'';}
function nested(row:Record<string,unknown>,key:string){const value=row[key];return record(value)?value:null;}
function option(kind:EntityPickerKind,value:unknown):EntityOption|null{
 if(!record(value))return null;
 if(kind==='CUSTOMER'){const customer=nested(value,'customer'),party=nested(value,'party');if(!customer||!party)return null;const id=text(customer.id);if(!id)return null;return{id,label:[text(customer.number),text(party.displayName)].filter(Boolean).join(' — '),detail:text(customer.status)};}
 if(kind==='AGENT'){const agent=nested(value,'agent'),party=nested(value,'party');if(!agent||!party)return null;const id=text(agent.id);if(!id)return null;return{id,label:[text(agent.number),text(party.displayName)].filter(Boolean).join(' — '),detail:text(agent.status)};}
 if(kind==='SUPPLIER'){const supplier=nested(value,'supplier'),party=nested(value,'party');if(!supplier||!party)return null;const id=text(supplier.id);if(!id)return null;return{id,label:[text(supplier.supplierCode),text(party.displayName)].filter(Boolean).join(' — '),detail:text(supplier.status)};}
 if(kind==='TRAVELER'){const id=text(value.id);if(!id)return null;return{id,label:text(value.fullName)||id,detail:[text(value.nationality),text(value.status)].filter(Boolean).join(' · ')};}
 if(kind==='LEAD'){const id=text(value.id);if(!id)return null;return{id,label:[text(value.number),text(value.displayName)].filter(Boolean).join(' — '),detail:[text(value.requestedService),text(value.status)].filter(Boolean).join(' · ')};}
 if(kind==='HAJJ_PROGRAM'){const id=text(value.id);if(!id)return null;return{id,label:[text(value.code),text(value.arabicName)].filter(Boolean).join(' — '),detail:text(value.status)};}
 if(kind==='TOURISM_PROGRAM'){const id=text(value.id);if(!id)return null;return{id,label:[text(value.code),text(value.nameAr)].filter(Boolean).join(' — '),detail:text(value.status)};}
 if(kind==='ACCOUNT'){const id=text(value.id);if(!id||value.active===false||value.postable===false)return null;return{id,label:[text(value.code),text(value.name)].filter(Boolean).join(' — '),detail:text(value.classification)};}
 const id=text(value.id);if(!id)return null;return{id,label:text(value.displayName)||text(value.username)||text(value.name)||id,detail:text(value.username)};
}
export async function loadEntityOptions(kind:EntityPickerKind):Promise<EntityOption[]>{
 const payload=await crmGet<unknown>(endpoint[kind]);
 const rows=kind==='ACCOUNT'&&record(payload)&&Array.isArray(payload.accounts)?payload.accounts:Array.isArray(payload)?payload:[];
 return rows.map(value=>option(kind,value)).filter((value):value is EntityOption=>value!==null).sort((a,b)=>a.label.localeCompare(b.label,'ar'));
}

export function EntityPicker({kind,label,value,onChange,required=false,includeBlank=true,disabled=false}:{readonly kind:EntityPickerKind;readonly label:string;readonly value:string;readonly onChange:(value:string)=>void;readonly required?:boolean;readonly includeBlank?:boolean;readonly disabled?:boolean}){
 const[options,setOptions]=useState<EntityOption[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;setLoading(true);void loadEntityOptions(kind).then(rows=>{if(active){setOptions(rows);setError('');}}).catch(()=>{if(active)setError('تعذر تحميل قائمة الاختيار.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[kind]);
 const current=options.some(item=>item.id===value);
 return <FormField label={label} required={required}>{loading?<LoadingState/>:<><Select required={required} disabled={disabled} value={value} onChange={event=>onChange(event.target.value)}>{includeBlank?<option value="">اختر من القائمة</option>:null}{value&&!current?<option value={value}>اختيار محفوظ</option>:null}{options.map(item=><option key={item.id} value={item.id}>{item.label}{item.detail?` — ${item.detail}`:''}</option>)}</Select>{error?<small role="status">{error}</small>:null}</>}</FormField>;
}

export function EntityMultiPicker({kind,label,values,onChange,required=false}:{readonly kind:EntityPickerKind;readonly label:string;readonly values:readonly string[];readonly onChange:(values:string[])=>void;readonly required?:boolean}){
 const[options,setOptions]=useState<EntityOption[]>([]),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;setLoading(true);void loadEntityOptions(kind).then(rows=>{if(active){setOptions(rows);setError('');}}).catch(()=>{if(active)setError('تعذر تحميل قائمة الاختيار.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[kind]);
 const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase('ar');return q?options.filter(item=>(item.label+' '+(item.detail??'')).toLocaleLowerCase('ar').includes(q)):options;},[options,query]);
 function toggle(id:string,checked:boolean){onChange(checked?[...new Set([...values,id])]:values.filter(value=>value!==id));}
 return <FormField label={label} required={required}>{loading?<LoadingState/>:<><Input aria-label={`بحث ${label}`} placeholder="ابحث بالاسم أو الكود" value={query} onChange={event=>setQuery(event.target.value)}/><div className="ui-page-stack">{filtered.map(item=><label key={item.id} className="ui-checkbox-field"><Checkbox checked={values.includes(item.id)} onChange={event=>toggle(item.id,event.target.checked)}/><span>{item.label}{item.detail?` — ${item.detail}`:''}</span></label>)}</div>{required&&!values.length?<small>اختر سجلًا واحدًا على الأقل.</small>:null}{error?<small role="status">{error}</small>:null}</>}</FormField>;
}
