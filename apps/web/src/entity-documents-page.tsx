import { type FormEvent, useEffect, useState } from 'react';
import { Button, Card, DataGrid, EmptyState, ErrorState, FormField, Input, LoadingState } from './ui.js';
import { crmDelete, crmGet, crmPost } from './crm-core-client.js';

type StoredFile={id:string;companyId:string;contentType:string;size:number;checksum:string|null;createdBy:string|null;createdAt:string};
type EntityFileLink={id:string;companyId:string;entityType:string;entityId:string;fileId:string;label:string|null;createdBy:string|null;createdAt:string;file:StoredFile};
type FileContent={metadata:StoredFile;contentBase64:string};
export interface EntityDocumentsPanelProps{entityId:string;basePath:string;emptyTitle:string;uploadTitle?:string;listTitle?:string}
const msg=(error:unknown)=>error instanceof Error?error.message:'تعذر تنفيذ عملية المستند.';
function bytesToBase64(bytes:Uint8Array){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(binary);}
function base64ToBytes(value:string){const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}

export function queryParam(name:string){return typeof window==='undefined'?'':new URLSearchParams(window.location.search).get(name)??'';}

export function EntityDocumentsPanel({entityId,basePath,emptyTitle,uploadTitle='إضافة مستند',listTitle='المستندات المرتبطة'}:EntityDocumentsPanelProps){
 const[rows,setRows]=useState<EntityFileLink[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[label,setLabel]=useState(''),[file,setFile]=useState<File|null>(null),[version,setVersion]=useState(0);
 useEffect(()=>{if(!entityId){setRows([]);setError('');setLoading(false);return;}let alive=true;setLoading(true);crmGet<EntityFileLink[]>(basePath).then(value=>{if(alive){setRows(value);setError('');}}).catch(value=>{if(alive)setError(msg(value));}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[entityId,basePath,version]);
 async function upload(event:FormEvent){event.preventDefault();if(!file||!entityId)return;try{const bytes=new Uint8Array(await file.arrayBuffer());await crmPost(basePath,{label:label.trim()||file.name,contentType:file.type||'application/octet-stream',contentBase64:bytesToBase64(bytes)});setNotice('تم حفظ المستند وربطه بالسجل.');setLabel('');setFile(null);setVersion(value=>value+1);}catch(value){setNotice(msg(value));}}
 async function download(row:EntityFileLink){try{const stored=await crmGet<FileContent>(basePath+'/'+encodeURIComponent(row.fileId));const blob=new Blob([base64ToBytes(stored.contentBase64)],{type:stored.metadata.contentType});const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=row.label?.trim()||`document-${row.fileId}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(value){setNotice(msg(value));}}
 async function remove(row:EntityFileLink){if(!window.confirm(`حذف المستند ${row.label??row.fileId}؟`))return;try{await crmDelete(basePath+'/'+encodeURIComponent(row.fileId));setNotice('تم حذف المستند وفك رابطه من السجل.');setVersion(value=>value+1);}catch(value){setNotice(msg(value));}}
 if(!entityId)return <EmptyState title="اختر سجلًا لعرض مستنداته"/>;
 return <>
  <Card title={uploadTitle}><form onSubmit={upload}><FormField label="اسم / وصف المستند"><Input value={label} onChange={event=>setLabel(event.target.value)} placeholder="مثال: عقد، تأكيد، فاتورة مرجعية أو هوية"/></FormField><FormField label="الملف" required><Input required type="file" onChange={event=>setFile(event.target.files?.[0]??null)}/></FormField>{file?<p>{file.name} — {Math.ceil(file.size/1024)} KB</p>:null}<Button type="submit" disabled={!file}>رفع المستند</Button></form>{notice?<p role="status">{notice}</p>:null}</Card>
  <Card title={listTitle}>{loading?<LoadingState label="جارٍ تحميل المستندات…"/>:error?<ErrorState message={error}/>:!rows.length?<EmptyState title={emptyTitle}/>:<DataGrid columns={['الوصف','النوع','الحجم','التاريخ','إجراءات']}>{rows.map(row=><tr key={row.id}><td>{row.label??'—'}</td><td>{row.file.contentType}</td><td>{Math.ceil(row.file.size/1024)} KB</td><td>{new Date(row.createdAt).toLocaleString('ar-EG')}</td><td><Button onClick={()=>void download(row)}>تحميل</Button><Button variant="danger" onClick={()=>void remove(row)}>حذف</Button></td></tr>)}</DataGrid>}</Card>
 </>;
}

export function EntityDocumentsPage({entityId,basePath,title,emptyTitle,description}:{entityId:string;basePath:string;title:string;emptyTitle:string;description:string}){
 return <section className="ui-page-stack" aria-label={title}>
  <Card title={title}><p>{description}</p><Button onClick={()=>history.back()}>العودة</Button></Card>
  <EntityDocumentsPanel entityId={entityId} basePath={basePath} emptyTitle={emptyTitle}/>
 </section>;
}
