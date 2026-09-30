import { type FormEvent, useEffect, useState } from 'react';
import { ActionBar, Button, Card, DataGrid, EmptyState, ErrorState, FormField, Input, LoadingState, MetricCard } from './ui.js';
import { crmDelete, crmGet, crmPost } from './crm-core-client.js';

type StoredFile={id:string;companyId:string;contentType:string;size:number;checksum:string|null;createdBy:string|null;createdAt:string};
type EntityFileLink={id:string;companyId:string;entityType:string;entityId:string;fileId:string;label:string|null;createdBy:string|null;createdAt:string;file:StoredFile};
type FileContent={metadata:StoredFile;contentBase64:string};
const queryParam=(name:string)=>typeof window==='undefined'?'':new URLSearchParams(window.location.search).get(name)??'';
const msg=(error:unknown)=>error instanceof Error?error.message:'تعذر تنفيذ عملية المستند.';
function bytesToBase64(bytes:Uint8Array){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(binary);}
function base64ToBytes(value:string){const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}

export function CrmCustomerDocumentsPage(){
 const customerId=queryParam('customerId');
 const[rows,setRows]=useState<EntityFileLink[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[label,setLabel]=useState(''),[file,setFile]=useState<File|null>(null),[version,setVersion]=useState(0);
 useEffect(()=>{if(!customerId){setError('لم يتم تحديد العميل.');setLoading(false);return;}let alive=true;setLoading(true);crmGet<EntityFileLink[]>(`/crm/customers/${encodeURIComponent(customerId)}/files`).then(value=>{if(alive){setRows(value);setError('');}}).catch(value=>{if(alive)setError(msg(value));}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[customerId,version]);
 async function upload(event:FormEvent){event.preventDefault();if(!file||!customerId)return;try{const bytes=new Uint8Array(await file.arrayBuffer());await crmPost(`/crm/customers/${encodeURIComponent(customerId)}/files`,{label:label.trim()||file.name,contentType:file.type||'application/octet-stream',contentBase64:bytesToBase64(bytes)});setNotice('تم حفظ المستند وربطه بالعميل.');setLabel('');setFile(null);setVersion(value=>value+1);}catch(error){setNotice(msg(error));}}
 async function download(row:EntityFileLink){try{const stored=await crmGet<FileContent>(`/crm/customers/${encodeURIComponent(customerId)}/files/${encodeURIComponent(row.fileId)}`);const blob=new Blob([base64ToBytes(stored.contentBase64)],{type:stored.metadata.contentType});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=row.label?.trim()||`document-${row.fileId}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){setNotice(msg(error));}}
 async function remove(row:EntityFileLink){if(!window.confirm(`حذف المستند ${row.label??row.fileId}؟`))return;try{await crmDelete(`/crm/customers/${encodeURIComponent(customerId)}/files/${encodeURIComponent(row.fileId)}`);setNotice('تم حذف المستند وفك مرجعه من العميل.');setVersion(value=>value+1);}catch(error){setNotice(msg(error));}}
 const totalSize=rows.reduce((sum,row)=>sum+row.file.size,0);
 return <section className="ui-dashboard" aria-label="مستندات العميل">
  <Card title="مستندات العميل"><p>مركز واحد لرفع وتنزيل المستندات المرتبطة بالعميل، بينما تخزين الملف نفسه يظل في Platform Core.</p><ActionBar><Button variant="secondary" onClick={()=>history.back()}>العودة</Button></ActionBar></Card>
  <div className="ui-metric-grid"><MetricCard label="عدد المستندات" value={rows.length}/><MetricCard label="إجمالي الحجم" value={`${Math.ceil(totalSize/1024)} KB`}/><MetricCard label="معرّف العميل" value={customerId||'—'}/></div>
  <section className="ui-dashboard-grid" aria-label="رفع وقائمة مستندات العميل">
   <Card title="إضافة مستند"><form onSubmit={upload} className="ui-filter-grid"><FormField label="اسم / وصف المستند"><Input value={label} onChange={event=>setLabel(event.target.value)} placeholder="مثال: صورة البطاقة أو عقد العميل"/></FormField><FormField label="الملف" required><Input required type="file" onChange={event=>setFile(event.target.files?.[0]??null)}/></FormField>{file?<p>{file.name} — {Math.ceil(file.size/1024)} KB</p>:null}<ActionBar><Button type="submit" disabled={!file}>رفع المستند</Button></ActionBar></form>{notice?<p role="status">{notice}</p>:null}</Card>
   <Card title="المستندات المرتبطة">{loading?<LoadingState label="جارٍ تحميل المستندات…"/>:error?<ErrorState message={error}/>:!rows.length?<EmptyState title="لا توجد مستندات مرتبطة بالعميل"/>:<DataGrid columns={['الوصف','النوع','الحجم','التاريخ','إجراءات']}>{rows.map(row=><tr key={row.id}><td><strong>{row.label??'—'}</strong></td><td>{row.file.contentType}</td><td>{Math.ceil(row.file.size/1024)} KB</td><td>{new Date(row.createdAt).toLocaleString('ar-EG')}</td><td><ActionBar><Button variant="secondary" onClick={()=>void download(row)}>تحميل</Button><Button variant="danger" onClick={()=>void remove(row)}>حذف</Button></ActionBar></td></tr>)}</DataGrid>}</Card>
  </section>
 </section>;
}
