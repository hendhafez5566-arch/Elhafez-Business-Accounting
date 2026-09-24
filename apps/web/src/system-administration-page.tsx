import {useEffect,useState} from 'react';
import {Button,Card,EmptyState,ErrorState,FormField,Input,LoadingState,Select,Tabs,Toast} from './ui.js';
import {HttpAdministrationClient,type AdministrationClient,type AdministrationContext} from './system-administration-client.js';

const areas=[
 ['المستخدمون','users'],['الأدوار والصلاحيات','roles'],['الشركات','companies'],['الفروع والوصول','branches'],
 ['الجلسات والأجهزة','sessions'],['سجل النشاط','audit'],['الملفات والمرفقات','files'],['الإشعارات','notifications'],
 ['إعدادات الشركة','configuration/locale'],['استيراد وتصدير البيانات','imports'],['النسخ الاحتياطي والاستعادة','operations/backups'],
 ['صحة النظام والتشخيص','operations/diagnostics']
] as const;
const labels:Record<string,string>={id:'المعرّف',name:'الاسم',displayName:'الاسم',email:'البريد',status:'الحالة',active:'نشط',type:'النوع',fileName:'الملف',format:'الصيغة',dataset:'مجموعة البيانات',createdAt:'تاريخ الإنشاء',readAt:'تاريخ القراءة',action:'العملية',resource:'المورد',backupProvider:'موفر النسخ',database:'قاعدة البيانات',schemaCompatibility:'توافق المخطط',runtimeVersion:'إصدار التشغيل',value:'القيمة',resultKey:'ملف التصدير'};
type DatasetOption={id:string;label:string;requiredFields:readonly string[];targetFields:readonly string[]};
type DownloadPayload={fileName:string;contentType:string;contentBase64:string};
type FilePayload={metadata:{id:string;contentType:string};contentBase64:string};

function valueOf(value:unknown){if(value===null||value===undefined)return'—';if(typeof value==='boolean')return value?'نعم':'لا';if(typeof value==='object')return'بيانات محفوظة';return String(value);}
function objectRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function datasetOption(value:unknown):value is DatasetOption{return objectRecord(value)&&typeof value.id==='string'&&typeof value.label==='string'&&Array.isArray(value.requiredFields)&&Array.isArray(value.targetFields);}
function downloadPayload(value:unknown):value is DownloadPayload{return objectRecord(value)&&typeof value.fileName==='string'&&typeof value.contentType==='string'&&typeof value.contentBase64==='string';}
function filePayload(value:unknown):value is FilePayload{return objectRecord(value)&&typeof value.contentBase64==='string'&&objectRecord(value.metadata)&&typeof value.metadata.id==='string'&&typeof value.metadata.contentType==='string';}
function fileAsBase64(file:File):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('تعذر قراءة الملف'));reader.onload=()=>{const result=String(reader.result??'');resolve(result.includes(',')?result.slice(result.indexOf(',')+1):result);};reader.readAsDataURL(file);});}
function configValue(text:string):unknown{try{return JSON.parse(text);}catch{return text;}}
function triggerDownload(payload:DownloadPayload){const binary=atob(payload.contentBase64);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const url=URL.createObjectURL(new Blob([bytes],{type:payload.contentType}));const anchor=document.createElement('a');anchor.href=url;anchor.download=payload.fileName;anchor.click();URL.revokeObjectURL(url);}

export function SystemAdministrationPage({client=new HttpAdministrationClient(),context}:{client?:AdministrationClient;context?:AdministrationContext}={}){
 const [selected,setSelected]=useState('users');
 const [rows,setRows]=useState<readonly unknown[]>([]);
 const [datasets,setDatasets]=useState<readonly DatasetOption[]>([]);
 const [sourceFields,setSourceFields]=useState<readonly string[]>([]);
 const [columnMapping,setColumnMapping]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState('');
 const [success,setSuccess]=useState('');
 const [form,setForm]=useState<Record<string,string>>({dataset:'CUSTOMERS',format:'CSV',mapping:'{}',configKey:'locale',configValue:'"ar"',retain:'7'});
 const ctx=context??{token:'',companyId:'',branchId:''};

 const field=(name:string)=>form[name]??'';
 const setField=(name:string,value:string)=>setForm(current=>({...current,[name]:value}));

 async function load(path=selected,clearFeedback=true){
  if(!ctx.token)return;setLoading(true);if(clearFeedback){setMessage('');setSuccess('');}
  try{
   setRows(await client.list(path,ctx));
   if(path==='imports')setDatasets((await client.list('data-exchange/datasets',ctx)).filter(datasetOption));
  }catch(error){setMessage(error instanceof Error?error.message:'تعذر التحميل');}
  finally{setLoading(false);}
 }

 async function selectArea(path:string){setSelected(path);await load(path);}

 async function run(label:string,operation:()=>Promise<unknown>,refresh=true){
  setLoading(true);setMessage('');setSuccess('');
  try{await operation();if(refresh)await load(selected,false);setSuccess(label);}
  catch(error){setMessage(error instanceof Error?error.message:'تعذر تنفيذ العملية');}
  finally{setLoading(false);}
 }

 async function importFile(file:File|undefined){if(!file)return;setField('importFileName',file.name);setField('format',file.name.toLowerCase().endsWith('.xlsx')?'XLSX':'CSV');setField('importContentBase64',await fileAsBase64(file));setField('importIdempotencyKey',crypto.randomUUID());setSourceFields([]);setColumnMapping({});}
 async function attachmentFile(file:File|undefined){if(!file)return;setField('fileContentType',file.type||'application/octet-stream');setField('fileContentBase64',await fileAsBase64(file));}
 async function downloadExport(){const payload=await client.read(`exports/${field('exportJobId')}/download`,ctx);if(!downloadPayload(payload))throw new Error('ملف التصدير غير متاح');triggerDownload(payload);}
 async function downloadFile(){const payload=await client.read(`files/${field('fileId')}`,ctx);if(!filePayload(payload))throw new Error('الملف غير متاح');triggerDownload({fileName:`file-${payload.metadata.id}`,contentType:payload.metadata.contentType,contentBase64:payload.contentBase64});}

 useEffect(()=>{if(ctx.token){setSelected('users');void load('users');}},[ctx.token,ctx.companyId,ctx.branchId]);
 const records=rows.filter(objectRecord);
 const selectedDataset=datasets.find(value=>value.id===field('dataset'));

 const input=(name:string,label:string,type='text')=><FormField label={label}><Input type={type} value={field(name)} onChange={event=>setField(name,event.target.value)}/></FormField>;
 const button=(label:string,onClick:()=>void)=><Button type="button" disabled={loading} onClick={onClick}>{label}</Button>;

 function actions(){
  if(selected==='users')return <div className="admin-actions">{input('userEmail','البريد','email')}{input('userName','الاسم')}{input('userPassword','كلمة مرور أولية','password')}{input('userRoleId','معرّف الدور (اختياري)')}{button('إنشاء مستخدم',()=>void run('تم إنشاء المستخدم.',()=>client.action('users',ctx,{email:field('userEmail'),displayName:field('userName'),password:field('userPassword'),roleId:field('userRoleId')||undefined})))}{input('userId','معرّف المستخدم')}{input('userAssignRoleId','معرّف الدور')}{button('إسناد الدور',()=>void run('تم إسناد الدور.',()=>client.action(`users/${field('userId')}/roles/${field('userAssignRoleId')}`,ctx)))}{button('سحب الدور',()=>void run('تم سحب الدور.',()=>client.remove(`users/${field('userId')}/roles/${field('userAssignRoleId')}`,ctx)))}{button('تعطيل المستخدم',()=>void run('تم تحديث المستخدم.',()=>client.patch(`users/${field('userId')}`,ctx,{active:false})))}{button('إعادة تفعيل المستخدم',()=>void run('تم تحديث المستخدم.',()=>client.patch(`users/${field('userId')}`,ctx,{active:true})))}</div>;
  if(selected==='roles')return <div className="admin-actions">{input('roleName','اسم الدور')}{button('إنشاء دور',()=>void run('تم إنشاء الدور.',()=>client.action('roles',ctx,{name:field('roleName')})))}{button('عرض الصلاحيات',()=>void load('permissions'))}{input('roleId','معرّف الدور')}{input('permissionId','معرّف الصلاحية')}{button('منح الصلاحية',()=>void run('تم منح الصلاحية.',()=>client.action(`roles/${field('roleId')}/permissions/${field('permissionId')}`,ctx)))}{button('سحب الصلاحية',()=>void run('تم سحب الصلاحية.',()=>client.remove(`roles/${field('roleId')}/permissions/${field('permissionId')}`,ctx)))}</div>;
  if(selected==='companies')return <div className="admin-actions">{input('companyName','اسم الشركة')}{button('إنشاء شركة',()=>void run('تم إنشاء الشركة.',()=>client.action('companies',ctx,{name:field('companyName')})))}{input('currentCompanyName','الاسم الجديد للشركة الحالية')}{button('تحديث اسم الشركة الحالية',()=>void run('تم تحديث الشركة.',()=>client.patch(`companies/${ctx.companyId}`,ctx,{name:field('currentCompanyName')}),false))}</div>;
  if(selected==='branches')return <div className="admin-actions">{input('branchName','اسم الفرع')}{button('إنشاء فرع',()=>void run('تم إنشاء الفرع.',()=>client.action('branches',ctx,{name:field('branchName')})))}{input('branchId','معرّف الفرع')}{input('accessUserId','معرّف المستخدم')}{button('منح وصول للفرع',()=>void run('تم منح الوصول.',()=>client.action(`branches/${field('branchId')}/access/${field('accessUserId')}`,ctx)))}{button('سحب وصول الفرع',()=>void run('تم سحب الوصول.',()=>client.remove(`branches/${field('branchId')}/access/${field('accessUserId')}`,ctx)))}{button('تعطيل الفرع',()=>void run('تم تحديث الفرع.',()=>client.patch(`branches/${field('branchId')}`,ctx,{active:false})))}</div>;
  if(selected==='sessions')return <div className="admin-actions">{input('sessionId','معرّف الجلسة')}{button('إنهاء الجلسة',()=>void run('تم إنهاء الجلسة.',()=>client.action(`sessions/${field('sessionId')}/revoke`,ctx)))}{input('sessionUserId','معرّف المستخدم')}{button('عرض جلسات المستخدم',()=>void load(`sessions/${field('sessionUserId')}`))}{button('إنهاء كل جلسات المستخدم',()=>void run('تم إنهاء جلسات المستخدم.',()=>client.action(`users/${field('sessionUserId')}/sessions/revoke`,ctx),false))}</div>;
  if(selected==='notifications')return <div className="admin-actions">{input('notificationId','معرّف الإشعار')}{button('تحديد كمقروء',()=>void run('تم تحديث الإشعار.',()=>client.action(`notifications/${field('notificationId')}/read`,ctx)))}</div>;
  if(selected.startsWith('configuration/'))return <div className="admin-actions">{input('configKey','مفتاح الإعداد')}{input('configValue','القيمة (JSON أو نص)')}{button('حفظ الإعداد',()=>void run('تم حفظ الإعداد.',()=>client.action(`configuration/${field('configKey')}`,ctx,{value:configValue(field('configValue'))}),false))}</div>;
  if(selected==='files')return <div className="admin-actions"><FormField label="رفع ملف"><Input type="file" onChange={event=>void attachmentFile(event.target.files?.[0])}/></FormField>{button('حفظ الملف',()=>void run('تم حفظ الملف.',()=>client.action('files',ctx,{contentType:field('fileContentType')||'application/octet-stream',contentBase64:field('fileContentBase64')})))}{input('fileId','معرّف الملف')}{button('تنزيل الملف',()=>void run('تم تجهيز الملف.',downloadFile,false))}{button('إلغاء الملف',()=>void run('تم إلغاء الملف.',()=>client.remove(`files/${field('fileId')}`,ctx)))}</div>;
  if(selected==='imports')return <div className="admin-actions">
   <FormField label="نوع البيانات"><Select value={field('dataset')} onChange={event=>{setField('dataset',event.target.value);setColumnMapping({});}}>{datasets.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</Select></FormField>
   <p>الحقول المطلوبة: {selectedDataset?.requiredFields.join('، ')||'—'}</p>
   <p>حقول النظام المتاحة: {selectedDataset?.targetFields.join('، ')||'—'}</p>
   <FormField label="ملف CSV أو XLSX"><Input type="file" accept=".csv,.xlsx" onChange={event=>void importFile(event.target.files?.[0])}/></FormField>
   {button('رفع ملف الاستيراد',()=>void run('تم رفع ملف الاستيراد.',async()=>{
    const result=await client.action('imports',ctx,{dataset:field('dataset'),fileName:field('importFileName'),format:field('format'),contentBase64:field('importContentBase64'),mapping:{},idempotencyKey:field('importIdempotencyKey')||crypto.randomUUID()});
    if(objectRecord(result)&&typeof result.id==='string'){
     setField('importJobId',result.id);
     const rows=Array.isArray(result.rows)?result.rows:[];
     const first=rows.find(objectRecord);
     const source=first&&objectRecord(first.source)?Object.keys(first.source):[];
     setSourceFields(source);
     const targets=selectedDataset?.targetFields??[];
     setColumnMapping(Object.fromEntries(source.filter(name=>targets.includes(name)).map(name=>[name,name])));
    }
    return result;
   },false))}
   {sourceFields.length?<fieldset><legend>مطابقة أعمدة الملف مع حقول النظام</legend>{sourceFields.map(source=><FormField key={source} label={source}><Select value={columnMapping[source]??''} onChange={event=>setColumnMapping(current=>({...current,[source]:event.target.value}))}><option value="">تجاهل العمود</option>{selectedDataset?.targetFields.map(target=><option key={target} value={target}>{target}</option>)}</Select></FormField>)}</fieldset>:null}
   {input('importJobId','معرّف مهمة الاستيراد')}
   {button('حفظ خريطة الأعمدة',()=>void run('تم حفظ خريطة الأعمدة.',()=>client.patch(`imports/${field('importJobId')}/mapping`,ctx,{mapping:Object.fromEntries(Object.entries(columnMapping).filter(([,target])=>Boolean(target)))}),false))}
   {button('معاينة والتحقق',()=>void run('تم التحقق من الملف.',()=>client.action(`imports/${field('importJobId')}/preview`,ctx)))}
   {button('تنفيذ الاستيراد',()=>void run('تم تنفيذ الاستيراد.',()=>client.action(`imports/${field('importJobId')}/execute`,ctx)))}
   <hr/>{input('exportFileName','اسم ملف التصدير')}{button('إنشاء تصدير CSV',()=>void run('تم إنشاء ملف التصدير.',async()=>{const result=await client.action('exports',ctx,{dataset:field('dataset'),fileName:field('exportFileName')||'export.csv',format:'CSV',idempotencyKey:`export-${Date.now()}`});if(objectRecord(result)&&typeof result.id==='string')setField('exportJobId',result.id);return result;},false))}{button('إنشاء تصدير XLSX',()=>void run('تم إنشاء ملف التصدير.',async()=>{const result=await client.action('exports',ctx,{dataset:field('dataset'),fileName:field('exportFileName')||'export.xlsx',format:'XLSX',idempotencyKey:`export-${Date.now()}`});if(objectRecord(result)&&typeof result.id==='string')setField('exportJobId',result.id);return result;},false))}{input('exportJobId','معرّف مهمة التصدير')}{button('تنزيل التصدير',()=>void run('تم تجهيز ملف التصدير.',downloadExport,false))}
  </div>;
  if(selected==='operations/backups')return <div className="admin-actions">{button('إنشاء نسخة احتياطية',()=>void run('تم إرسال طلب النسخ الاحتياطي.',()=>client.action('operations/backups',ctx,{})))}{input('backupId','معرّف النسخة')}{button('التحقق من النسخة',()=>void run('تم التحقق من النسخة.',()=>client.action(`operations/backups/${field('backupId')}/verify`,ctx)))}{button('تثبيت النسخة',()=>void run('تم تثبيت النسخة.',()=>client.action(`operations/backups/${field('backupId')}/pin`,ctx,{pinned:true})))}{button('فحص الاستعادة مسبقًا',()=>void run('نجح فحص الاستعادة.',()=>client.action(`operations/restores/${field('backupId')}/preflight`,ctx),false))}{button('بدء الاستعادة',()=>void run('تم تنفيذ طلب الاستعادة.',async()=>{const result=await client.action('operations/restores',ctx,{backupId:field('backupId')});if(objectRecord(result)&&typeof result.id==='string')setField('restoreId',result.id);return result;},false))}{input('restoreId','معرّف الاستعادة')}{button('عرض حالة الاستعادة',()=>void run('تم تحميل حالة الاستعادة.',async()=>{const result=await client.read(`operations/restores/${field('restoreId')}`,ctx);setRows([result]);return result;},false))}{input('retain','عدد النسخ المحتفظ بها','number')}{button('تطبيق سياسة الاحتفاظ',()=>void run('تم تطبيق سياسة الاحتفاظ.',()=>client.action('operations/backups/retention',ctx,{retain:Number(field('retain'))})))}</div>;
  return null;
 }

 return <section dir="rtl" aria-label="إدارة النظام والعمليات" className="ui-admin-page">
  <Card title="إدارة المنصة"><p>لوحة عربية موحدة وآمنة لإدارة الوصول والبيانات واستمرارية التشغيل.</p><Tabs tabs={areas.map(([label,id])=>({id,label}))} active={selected} onChange={id=>{if(ctx.token)void selectArea(id)}}/></Card>
  <section aria-live="polite" className="ui-section-space">
   {!ctx.token?<EmptyState title="يلزم تسجيل الدخول">اختر الشركة والفرع وسجّل الدخول لعرض أدوات الإدارة.</EmptyState>:<>
    <div className="ui-inline"><Button type="button" variant="secondary" disabled={loading} onClick={()=>void load()}>تحديث البيانات</Button></div>
    {actions()}
    {loading?<LoadingState/>:message?<ErrorState message={message}/>:success?<Toast tone="success">{success}</Toast>:records.length===0?<EmptyState title="لا توجد بيانات متاحة"/>:<div className="ui-grid-md ui-section-space">
     {records.map((record,index)=><Card key={String(record.id??index)} className="ui-record-card">{Object.entries(record).filter(([key,value])=>labels[key]&&typeof value!=='object').map(([key,value])=><p key={key}><strong>{labels[key]}: </strong>{valueOf(value)}</p>)}</Card>)}
    </div>}
   </>}
  </section>
 </section>;
}
