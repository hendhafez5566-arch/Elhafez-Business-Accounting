import {useEffect,useState} from 'react';
import {Button,Card,DisclosureCard,EmptyState,ErrorState,FormField,Input,LoadingState,Select,Toast} from './ui.js';
import {SettingsWorkspace,WorkspaceNavigation} from './ui/screen-layouts.js';
import {HttpAdministrationClient,type AdministrationClient,type AdministrationContext} from './system-administration-client.js';
import {CompanyProfilePanel} from './company-profile-panel.js';
import {tenantApiContext} from './tenant-session.js';

const areas=[
 ['المستخدمون','users'],['الأدوار والصلاحيات','roles'],['الشركات','companies'],['الفروع والوصول','branches'],
 ['الجلسات والأجهزة','sessions'],['سجل النشاط','audit'],['الملفات والمرفقات','files'],['الإشعارات','notifications'],
 ['إعدادات الشركة','configuration/locale'],['استيراد وتصدير البيانات','imports'],
 ['صحة النظام والتشخيص','operations/diagnostics']
] as const;
const labels:Record<string,string>={id:'المعرّف',name:'الاسم',displayName:'الاسم',username:'اسم المستخدم',mustChangePassword:'تغيير كلمة المرور مطلوب',status:'الحالة',active:'نشط',type:'النوع',fileName:'الملف',format:'الصيغة',dataset:'مجموعة البيانات',createdAt:'تاريخ الإنشاء',expiresAt:'تاريخ الانتهاء',revokedAt:'تاريخ الإنهاء',readAt:'تاريخ القراءة',action:'العملية',resource:'المورد',backupProvider:'موفر النسخ',database:'قاعدة البيانات',schemaCompatibility:'توافق المخطط',runtimeVersion:'إصدار التشغيل',value:'القيمة',resultKey:'ملف التصدير'};
const rolePresets=['مدير نظام كامل','مدير فرع','محاسب','مسؤول خزينة','مبيعات وحجوزات','مراجع داخلي'] as const;
const permissionAreas:Record<string,string>={'platform.users':'المستخدمون','platform.roles':'الأدوار والصلاحيات','platform.companies':'الشركات','platform.branches':'الفروع','platform.audit':'سجل النشاط','platform.sessions':'الجلسات والأجهزة','platform.notifications':'الإشعارات','platform.files':'الملفات والمرفقات','platform.configuration':'إعدادات الشركة','data_exchange':'استيراد وتصدير','platform_operations':'التشخيص والتشغيل'};
type DatasetOption={id:string;label:string;requiredFields:readonly string[];targetFields:readonly string[]};
type DownloadPayload={fileName:string;contentType:string;contentBase64:string};
type FilePayload={metadata:{id:string;contentType:string};contentBase64:string};

function valueOf(value:unknown){if(value===null||value===undefined)return'—';if(typeof value==='boolean')return value?'نعم':'لا';if(typeof value==='object')return'بيانات محفوظة';return String(value);}
function objectRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function datasetOption(value:unknown):value is DatasetOption{return objectRecord(value)&&typeof value.id==='string'&&typeof value.label==='string'&&Array.isArray(value.requiredFields)&&Array.isArray(value.targetFields);}
function downloadPayload(value:unknown):value is DownloadPayload{return objectRecord(value)&&typeof value.fileName==='string'&&typeof value.contentType==='string'&&typeof value.contentBase64==='string';}
function filePayload(value:unknown):value is FilePayload{return objectRecord(value)&&typeof value.contentBase64==='string'&&objectRecord(value.metadata)&&typeof value.metadata.id==='string'&&typeof value.metadata.contentType==='string';}
function fileAsBase64(file:File):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('تعذر قراءة الملف'));reader.onload=()=>{const result=String(reader.result??'');resolve(result.includes(',')?result.slice(result.indexOf(',')+1):result);};reader.readAsDataURL(file);});}
function triggerDownload(payload:DownloadPayload){const binary=atob(payload.contentBase64);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const url=URL.createObjectURL(new Blob([bytes],{type:payload.contentType}));const anchor=document.createElement('a');anchor.href=url;anchor.download=payload.fileName;anchor.click();URL.revokeObjectURL(url);}
function text(value:unknown){return typeof value==='string'?value:'';}
function idOf(record:Record<string,unknown>){return text(record.id);}
function userLabel(record:Record<string,unknown>){return `${text(record.displayName)||text(record.username)||idOf(record)}${text(record.username)?` — ${text(record.username)}`:''}`;}
function permissionLabel(record:Record<string,unknown>){const name=text(record.name),parts=name.split('.'),key=name.startsWith('platform.')?parts.slice(0,2).join('.'):parts[0]??'';return `${(permissionAreas[key]??key)||'صلاحيات'} — ${name||idOf(record)}`;}

export function SystemAdministrationPage({client=new HttpAdministrationClient(),context,initialArea='users'}:{client?:AdministrationClient;context?:AdministrationContext;initialArea?:string}={}){
 const [selected,setSelected]=useState(initialArea);
 const [rows,setRows]=useState<readonly unknown[]>([]);
 const [users,setUsers]=useState<readonly Record<string,unknown>[]>([]);
 const [roles,setRoles]=useState<readonly Record<string,unknown>[]>([]);
 const [permissions,setPermissions]=useState<readonly Record<string,unknown>[]>([]);
 const [branches,setBranches]=useState<readonly Record<string,unknown>[]>([]);
 const [datasets,setDatasets]=useState<readonly DatasetOption[]>([]);
 const [sourceFields,setSourceFields]=useState<readonly string[]>([]);
 const [columnMapping,setColumnMapping]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState('');
 const [success,setSuccess]=useState('');
 const [form,setForm]=useState<Record<string,string>>({dataset:'CUSTOMERS',format:'CSV',mapping:'{}',retain:'7'});
 const ctx=context??tenantApiContext();

 const field=(name:string)=>form[name]??'';
 const setField=(name:string,value:string)=>setForm(current=>({...current,[name]:value}));

 async function loadReferences(){
  if(!ctx.token)return;
  const [userResult,roleResult,permissionResult,branchResult]=await Promise.allSettled([
   client.list('users',ctx),client.list('roles',ctx),client.list('permissions',ctx),client.list('branches',ctx)
  ]);
  if(userResult.status==='fulfilled')setUsers(userResult.value.filter(objectRecord));
  if(roleResult.status==='fulfilled')setRoles(roleResult.value.filter(objectRecord));
  if(permissionResult.status==='fulfilled')setPermissions(permissionResult.value.filter(objectRecord));
  if(branchResult.status==='fulfilled')setBranches(branchResult.value.filter(objectRecord));
 }

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
  try{
   await operation();
   if(refresh)await Promise.all([load(selected,false),loadReferences()]);
   setSuccess(label);
  }catch(error){setMessage(error instanceof Error?error.message:'تعذر تنفيذ العملية');}
  finally{setLoading(false);}
 }

 async function importFile(file:File|undefined){if(!file)return;setField('importFileName',file.name);setField('format',file.name.toLowerCase().endsWith('.xlsx')?'XLSX':'CSV');setField('importContentBase64',await fileAsBase64(file));setField('importIdempotencyKey',crypto.randomUUID());setSourceFields([]);setColumnMapping({});}
 async function attachmentFile(file:File|undefined){if(!file)return;setField('fileContentType',file.type||'application/octet-stream');setField('fileContentBase64',await fileAsBase64(file));}
 async function downloadExport(){const payload=await client.read(`exports/${field('exportJobId')}/download`,ctx);if(!downloadPayload(payload))throw new Error('ملف التصدير غير متاح');triggerDownload(payload);}
 async function downloadFile(){const payload=await client.read(`files/${field('fileId')}`,ctx);if(!filePayload(payload))throw new Error('الملف غير متاح');triggerDownload({fileName:`file-${payload.metadata.id}`,contentType:payload.metadata.contentType,contentBase64:payload.contentBase64});}

 useEffect(()=>{if(ctx.token){setSelected(initialArea);void Promise.all([load(initialArea),loadReferences()]);}},[ctx.token,ctx.companyId,ctx.branchId,initialArea]);
 const records=rows.filter(objectRecord);
 const selectedDataset=datasets.find(value=>value.id===field('dataset'));
 const selectedUser=users.find(record=>idOf(record)===field('userId'));
 const selectedBranch=branches.find(record=>idOf(record)===field('branchId'));

 const input=(name:string,label:string,type='text')=><FormField label={label}><Input type={type} value={field(name)} onChange={event=>setField(name,event.target.value)}/></FormField>;
 const button=(label:string,onClick:()=>void)=><Button type="button" disabled={loading} onClick={onClick}>{label}</Button>;
 const select=(name:string,label:string,options:readonly {value:string;label:string}[],placeholder='اختر')=><FormField label={label}><Select value={field(name)} onChange={event=>setField(name,event.target.value)}><option value="">{placeholder}</option>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</Select></FormField>;
 const userSelect=(name='userId',label='اختيار المستخدم')=>select(name,label,users.map(record=>({value:idOf(record),label:userLabel(record)})).filter(option=>option.value));
 const roleSelect=(name='userAssignRoleId',label='اختيار الدور',optional=false)=>select(name,label,roles.map(record=>({value:idOf(record),label:text(record.name)||idOf(record)})).filter(option=>option.value),optional?'بدون دور الآن':'اختر الدور');
 const branchSelect=(name='branchId',label='اختيار الفرع')=>select(name,label,branches.map(record=>({value:idOf(record),label:`${text(record.name)||idOf(record)}${record.active===false?' — معطّل':''}`})).filter(option=>option.value));
 const permissionSelect=(name='permissionId',label='اختيار الصلاحية')=>select(name,label,permissions.map(record=>({value:idOf(record),label:permissionLabel(record)})).filter(option=>option.value));
 const sessionSelect=(name='sessionId',label='اختيار الجلسة')=>select(name,label,records.map(record=>({value:idOf(record),label:`${text(record.status)||'جلسة'} — ${text(record.createdAt)||idOf(record)}`})).filter(option=>option.value));

 function actions(){
  if(selected==='users')return <div className="ui-admin-workflows">
   <DisclosureCard title="إنشاء مستخدم" description="إنشاء حساب جديد وربطه اختياريًا بدور موجود. الفرع الحالي هو نطاق الإنشاء الافتراضي.">
    <div className="admin-actions">{input('userUsername','اسم المستخدم')}{input('userName','الاسم')}{input('userPassword','كلمة مرور مؤقتة','password')}{roleSelect('userRoleId','الدور (اختياري)',true)}{button('إنشاء مستخدم',()=>void run('تم إنشاء المستخدم. يجب تغيير كلمة المرور في أول دخول.',()=>client.action('users',ctx,{username:field('userUsername'),displayName:field('userName'),temporaryPassword:field('userPassword'),roleId:field('userRoleId')||undefined})))}</div>
   </DisclosureCard>
   <DisclosureCard title="ملف المستخدم الإداري" description="إدارة هوية المستخدم وحالته ودوره ووصوله للفروع وجلساته من اختيار واحد بدل كتابة المعرّفات الداخلية.">
    <div className="admin-actions">
     {userSelect()}
     {selectedUser?<Card title={text(selectedUser.displayName)||text(selectedUser.username)||'المستخدم'}>
      <p><strong>اسم المستخدم: </strong>{text(selectedUser.username)||'—'}</p>
      <p><strong>الحالة: </strong>{text(selectedUser.status)==='ACTIVE'?'نشط':'غير نشط'}</p>
      <p><strong>تغيير كلمة المرور مطلوب: </strong>{selectedUser.mustChangePassword===true?'نعم':'لا'}</p>
     </Card>:null}
     {input('resetUsername','اسم المستخدم لإعادة التعيين')}{input('resetPassword','كلمة مرور مؤقتة جديدة','password')}
     {button('إعادة تعيين بيانات الدخول',()=>void run('تمت إعادة تعيين بيانات الدخول وإلغاء الجلسات القديمة.',()=>client.action(`users/${field('userId')}/credentials`,ctx,{username:field('resetUsername'),temporaryPassword:field('resetPassword')}),false))}
     {roleSelect()}
     {button('إسناد الدور',()=>void run('تم إسناد الدور.',()=>client.action(`users/${field('userId')}/roles/${field('userAssignRoleId')}`,ctx)))}
     {button('سحب الدور',()=>void run('تم سحب الدور.',()=>client.remove(`users/${field('userId')}/roles/${field('userAssignRoleId')}`,ctx)))}
     {branchSelect('userBranchId','اختيار فرع الوصول')}
     {button('منح وصول للفرع',()=>void run('تم منح الوصول.',()=>client.action(`branches/${field('userBranchId')}/access/${field('userId')}`,ctx)))}
     {button('سحب وصول الفرع',()=>void run('تم سحب الوصول.',()=>client.remove(`branches/${field('userBranchId')}/access/${field('userId')}`,ctx)))}
     {button('تعطيل المستخدم',()=>void run('تم تحديث المستخدم.',()=>client.patch(`users/${field('userId')}`,ctx,{active:false})))}
     {button('إعادة تفعيل المستخدم',()=>void run('تم تحديث المستخدم.',()=>client.patch(`users/${field('userId')}`,ctx,{active:true}))) }
     {button('عرض جلسات المستخدم',()=>{setField('sessionUserId',field('userId'));setSelected('sessions');void load(`sessions/${field('userId')}`);})}
    </div>
   </DisclosureCard>
   <Card title="حدود الاعتماد ومشاهدة التكلفة"><p>حد اعتماد المدفوعات والسياسات المالية يملكها مركز الموافقات، بينما مشاهدة التكلفة تُحكم بصلاحيات Platform Core. لا تُحفظ قيم موازية على المستخدم.</p><div className="ui-inline"><a href="/approvals">فتح الاعتمادات</a><a href="/accounting">فتح السياسات المالية</a></div></Card>
  </div>;
  if(selected==='roles')return <div className="ui-admin-workflows">
   <DisclosureCard title="إنشاء دور" description="الأسماء القديمة تظهر كاقتراحات UX فقط؛ نظام الصلاحيات الفعلي يظل Platform Core RBAC.">
    <div className="admin-actions">{select('rolePreset','اقتراح اسم الدور',rolePresets.map(value=>({value,label:value})),'اختياري')}{field('rolePreset')?button('استخدام الاسم المقترح',()=>setField('roleName',field('rolePreset'))):null}{input('roleName','اسم الدور')}{button('إنشاء دور',()=>void run('تم إنشاء الدور.',()=>client.action('roles',ctx,{name:field('roleName')})))}</div>
   </DisclosureCard>
   <DisclosureCard title="محرر الصلاحيات" description="اختر الدور والصلاحية من القوائم الرسمية ثم امنح أو اسحب. لا توجد خريطة صلاحيات موازية في الواجهة.">
    <div className="admin-actions">{roleSelect('roleId','اختيار الدور')}{permissionSelect()}{button('منح الصلاحية',()=>void run('تم منح الصلاحية.',()=>client.action(`roles/${field('roleId')}/permissions/${field('permissionId')}`,ctx)))}{button('سحب الصلاحية',()=>void run('تم سحب الصلاحية.',()=>client.remove(`roles/${field('roleId')}/permissions/${field('permissionId')}`,ctx)))}</div>
   </DisclosureCard>
  </div>;
  if(selected==='companies')return <div className="admin-actions"><p>إنشاء الشركات الجديدة وإدارة الاشتراك يتمان حصريًا من مركز تحكم مالك المنصة.</p>{input('currentCompanyName','الاسم الجديد للشركة الحالية')}{button('تحديث اسم الشركة الحالية',()=>void run('تم تحديث الشركة.',()=>client.patch(`companies/${ctx.companyId}`,ctx,{name:field('currentCompanyName')}),false))}</div>;
  if(selected==='branches')return <div className="ui-admin-workflows">
   <DisclosureCard title="إنشاء فرع" description="إنشاء فرع جديد داخل الشركة الحالية.">
    <div className="admin-actions">{input('branchName','اسم الفرع')}{button('إنشاء فرع',()=>void run('تم إنشاء الفرع.',()=>client.action('branches',ctx,{name:field('branchName')})))}</div>
   </DisclosureCard>
   <DisclosureCard title="إدارة الفرع والوصول" description="اختر الفرع والمستخدم بدل إدخال المعرّفات الداخلية.">
    <div className="admin-actions">{branchSelect()}{selectedBranch?<p><strong>حالة الفرع: </strong>{selectedBranch.active===false?'معطّل':'نشط'}</p>:null}{userSelect('accessUserId','اختيار المستخدم')}{button('منح وصول للفرع',()=>void run('تم منح الوصول.',()=>client.action(`branches/${field('branchId')}/access/${field('accessUserId')}`,ctx)))}{button('سحب وصول الفرع',()=>void run('تم سحب الوصول.',()=>client.remove(`branches/${field('branchId')}/access/${field('accessUserId')}`,ctx)))}{button('تعطيل الفرع',()=>void run('تم تحديث الفرع.',()=>client.patch(`branches/${field('branchId')}`,ctx,{active:false})))}{button('إعادة تفعيل الفرع',()=>void run('تم تحديث الفرع.',()=>client.patch(`branches/${field('branchId')}`,ctx,{active:true})))}</div>
   </DisclosureCard>
  </div>;
  if(selected==='sessions')return <div className="ui-admin-workflows">
   <DisclosureCard title="جلسات المستخدم" description="اختر المستخدم لعرض جلساته وإنهائها دون الحاجة لمعرفة معرف المستخدم أو الجلسة.">
    <div className="admin-actions">{userSelect('sessionUserId','اختيار المستخدم')}{button('عرض جلسات المستخدم',()=>void load(`sessions/${field('sessionUserId')}`))}{button('إنهاء كل جلسات المستخدم',()=>void run('تم إنهاء جلسات المستخدم.',()=>client.action(`users/${field('sessionUserId')}/sessions/revoke`,ctx),false))}{records.length?sessionSelect():null}{records.length?button('إنهاء الجلسة',()=>void run('تم إنهاء الجلسة.',()=>client.action(`sessions/${field('sessionId')}/revoke`,ctx))):null}</div>
   </DisclosureCard>
  </div>;
  if(selected==='notifications')return <div className="admin-actions">{input('notificationId','معرّف الإشعار')}{button('تحديد كمقروء',()=>void run('تم تحديث الإشعار.',()=>client.action(`notifications/${field('notificationId')}/read`,ctx)))}</div>;
  if(selected.startsWith('configuration/'))return <CompanyProfilePanel client={client} context={ctx}/>;
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
  return null;
 }

 return <section dir="rtl" aria-label="إدارة النظام والعمليات" className="ui-admin-page">
  <Card title="إدارة المنصة"><p>لوحة عربية موحدة وآمنة لإدارة الوصول والبيانات واستمرارية التشغيل.</p></Card>
  <SettingsWorkspace navigation={<WorkspaceNavigation ariaLabel="أقسام إدارة النظام" items={areas.map(([label,id])=>({id,label}))} active={selected} onChange={id=>{if(ctx.token)void selectArea(id)}}/>} content={<section aria-live="polite" className="ui-section-space">
   {!ctx.token?<EmptyState title="يلزم تسجيل الدخول">اختر الشركة والفرع وسجّل الدخول لعرض أدوات الإدارة.</EmptyState>:<>
    <div className="ui-inline"><Button type="button" variant="secondary" disabled={loading} onClick={()=>void Promise.all([load(),loadReferences()])}>تحديث البيانات</Button></div>
    {actions()}
    {loading?<LoadingState/>:message?<ErrorState message={message}/>:success?<Toast tone="success">{success}</Toast>:records.length===0?<EmptyState title="لا توجد بيانات متاحة"/>:<div className="ui-grid-md ui-section-space">
     {records.map((record,index)=><Card key={String(record.id??index)} className="ui-record-card">{Object.entries(record).filter(([key,value])=>labels[key]&&typeof value!=='object').map(([key,value])=><p key={key}><strong>{labels[key]}: </strong>{valueOf(value)}</p>)}</Card>)}
    </div>}
   </>}
  </section>}/>
 </section>;
}
