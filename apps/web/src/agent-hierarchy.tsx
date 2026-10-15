import { useEffect, useState } from 'react';
import { Button, Card, DataGrid, FormField, Select } from './ui.js';
import { crmGet, crmPost } from './crm-core-client.js';

type AgentRow={agent:{id:string;number:string;status:string;parentAgentId?:string|null};party:{displayName:string}};
export function AgentHierarchy(){
 const[rows,setRows]=useState<AgentRow[]>([]),[child,setChild]=useState(''),[parent,setParent]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function load(){try{setRows(await crmGet<AgentRow[]>('/crm/agents'));}catch(error){setNotice(error instanceof Error?error.message:'تعذر تحميل علاقات المندوبين.');}}
 useEffect(()=>{void load();},[]);
 async function save(){
  if(!child||busy)return;setBusy(true);setNotice('');
  try{await crmPost(`/crm/agents/${encodeURIComponent(child)}/parent`,{parentAgentId:parent||null});setNotice('حُفظت علاقة المندوب؛ لم تتغير العمولات أو حسابات الحجوزات.');await load();}
  catch(error){setNotice(error instanceof Error?error.message:'تعذر حفظ العلاقة.');}finally{setBusy(false);}
 }
 const byId=new Map(rows.map(v=>[v.agent.id,v])),counts=new Map<string,number>();
 for(const row of rows)if(row.agent.parentAgentId)counts.set(row.agent.parentAgentId,(counts.get(row.agent.parentAgentId)??0)+1);
 const label=(id:string|null|undefined)=>{const row=id?byId.get(id):undefined;return row?`${row.agent.number} — ${row.party.displayName}`:id?'مندوب غير متاح في العرض':'مستقل / رئيسي';};
 return <Card title="المندوب الرئيسي والتابعون">
  <p>العلاقة تنظيمية ويمكن تغييرها أو فصلها. لا تنقل مديونية أو عمولة، ولا تغيّر اتفاقات الحجوزات السابقة.</p>
  <FormField label="المندوب المطلوب ربطه"><Select disabled={busy} value={child} onChange={event=>{setChild(event.target.value);setParent(rows.find(v=>v.agent.id===event.target.value)?.agent.parentAgentId??'');}}><option value="">اختر المندوب</option>{rows.map(v=><option key={v.agent.id} value={v.agent.id}>{label(v.agent.id)}</option>)}</Select></FormField>
  <FormField label="المندوب الرئيسي"><Select disabled={busy||!child} value={parent} onChange={event=>setParent(event.target.value)}><option value="">بدون مندوب رئيسي</option>{rows.filter(v=>v.agent.id!==child&&(v.agent.status==='ACTIVE'||v.agent.id===parent)).map(v=><option key={v.agent.id} value={v.agent.id}>{label(v.agent.id)}{v.agent.status!=='ACTIVE'?' — معلّق':''}</option>)}</Select></FormField>
  <Button type="button" disabled={busy||!child} onClick={()=>void save()}>حفظ علاقة المندوب</Button><Button type="button" disabled={busy} onClick={()=>void load()}>تحديث علاقات المندوبين</Button>
  {notice?<p role="status">{notice}</p>:null}
  {rows.length?<DataGrid columns={['المندوب','الرئيسي','التابعون المباشرون']}>{rows.map(v=><tr key={v.agent.id}><td>{label(v.agent.id)}</td><td>{label(v.agent.parentAgentId)}</td><td>{counts.get(v.agent.id)??0}</td></tr>)}</DataGrid>:null}
 </Card>;
}
