import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {Badge,Button,Card,ErrorState,FormField,Input,LoadingState,Tabs,Toast} from './ui.js';
import {HttpAdministrationClient,type AdministrationClient,type AdministrationContext} from './system-administration-client.js';
import {tenantApiContext} from './tenant-session.js';

type ReadinessStatus='READY'|'BLOCKED'|'UNKNOWN';
type Check={id:string;label:string;status:ReadinessStatus;detail:string};
type Diagnostics={database?:unknown;backupProvider?:unknown;restoreReady?:unknown;maintenance?:unknown;schemaCompatibility?:unknown;runtimeVersion?:unknown};
type Tab='readiness'|'guide'|'identity';
type DocumentIdentity={legalName:string;commercialRegistration:string;taxRegistration:string;phone:string;email:string;address:string;website:string;accountant:string;reviewer:string;approver:string;logoFileId:string};
const blankIdentity:DocumentIdentity={legalName:'',commercialRegistration:'',taxRegistration:'',phone:'',email:'',address:'',website:'',accountant:'',reviewer:'',approver:'',logoFileId:''};
const guide=[
 {title:'1. بيانات الشركة وهوية المستندات',detail:'ثبت الاسم القانوني وبيانات الاتصال والسجل والرقم الضريبي والتوقيعات التي تظهر على المستندات.',href:'/system/readiness?tab=identity'},
 {title:'2. الفروع والمستخدمون والصلاحيات',detail:'أنشئ الفروع، المستخدمين والأدوار ثم امنح كل مستخدم أقل صلاحية لازمة للعمل.',href:'/system-administration'},
 {title:'3. الإعدادات المحاسبية',detail:'راجع السنة المالية، الفترات، دليل الحسابات، العملات ومراكز التكلفة قبل إدخال حركة فعلية.',href:'/accounting'},
 {title:'4. العملاء والموردون والمندوبون',detail:'أنشئ الأطراف من ملفاتهم الأساسية حتى تستخدم نفس الهوية في المبيعات والمشتريات والحسابات بدون تكرار.',href:'/crm/customers'},
 {title:'5. الخزن والبنوك',detail:'عرّف الخزن والحسابات البنكية وسياسات التحصيل والصرف والتسوية قبل أول سند.',href:'/accounting'},
 {title:'6. العقود والمخزون والبرامج',detail:'ابدأ من التعاقدات والمخزون ثم كوّن البرنامج واربط الفنادق والطيران والنقل والتأشيرات من نفس المصادر.',href:'/hajj-umrah/contracts-inventory'},
 {title:'7. أول دورة بيع وتشغيل',detail:'أنشئ عرض سعر أو حجز، نفذ التحصيل، شغّل الخدمة أو الرحلة ثم راجع المستندات والتقارير الناتجة.',href:'/crm/quotations'},
 {title:'8. الاختبار قبل التسليم',detail:'ارجع إلى فحص الجاهزية وتأكد أن قاعدة البيانات والنسخ الاحتياطي والمستخدمين والإعدادات كلها جاهزة.',href:'/system/readiness'}
] as const;

function record(value:unknown):Record<string,unknown>|undefined{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;}
function isRecord(value:unknown):value is Record<string,unknown>{return record(value)!==undefined;}
function active(value:Record<string,unknown>){return value.active!==false&&value.status!=='DISABLED'&&value.status!=='INACTIVE';}
function named(value:Record<string,unknown>){return typeof value.name==='string'&&value.name.trim().length>0;}
function diagnostic(value:unknown):Diagnostics{return record(value)??{};}
function configValue(value:unknown){return record(value)?.value;}
function configured(value:unknown){return value!==null&&value!==undefined&&String(value).trim().length>0;}
function identityFrom(value:unknown):DocumentIdentity{const data=record(value);return data?{...blankIdentity,...Object.fromEntries(Object.keys(blankIdentity).map(key=>[key,typeof data[key]==='string'?data[key]:'']))} as DocumentIdentity:blankIdentity;}
function unknown(id:string,label:string,error:unknown):Check{return{id,label,status:'UNKNOWN',detail:error instanceof Error?error.message:'تعذر التحقق من هذا البند.'};}

export function SystemReadinessPage({client=new HttpAdministrationClient(),context}:{client?:AdministrationClient;context?:AdministrationContext}={}){
 const ctx=context??tenantApiContext();
 const requested=new URLSearchParams(window.location.search).get('tab');
 const [tab,setTab]=useState<Tab>(requested==='identity'?'identity':requested==='guide'?'guide':'readiness');
 const [checks,setChecks]=useState<readonly Check[]>([]);
 const [identity,setIdentity]=useState<DocumentIdentity>(blankIdentity);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');

 async function load(){
  if(!ctx.token)return;
  setLoading(true);setError('');
  const next:Check[]=[];
  let identityValue:unknown;
  const run=async(id:string,label:string,operation:()=>Promise<Check>)=>{try{next.push(await operation());}catch(cause){next.push(unknown(id,label,cause));}};
  await Promise.all([
   run('company','بيانات الشركة',async()=>{const rows=(await client.list('companies',ctx)).filter(isRecord);const company=rows.find(item=>item.id===ctx.companyId);return{id:'company',label:'بيانات الشركة',status:company&&named(company)&&active(company)?'READY':'BLOCKED',detail:company&&named(company)?String(company.name):'اسم الشركة أو حالة الشركة غير مكتملين.'};}),
   run('branch','الفرع الحالي',async()=>{const rows=(await client.list('branches',ctx)).filter(isRecord);const branch=rows.find(item=>item.id===ctx.branchId);return{id:'branch',label:'الفرع الحالي',status:branch&&named(branch)&&active(branch)?'READY':'BLOCKED',detail:branch&&named(branch)?String(branch.name):'الفرع الحالي غير مهيأ أو غير نشط.'};}),
   run('users','المستخدمون',async()=>{const rows=(await client.list('users',ctx)).filter(isRecord);const count=rows.filter(active).length;return{id:'users',label:'المستخدمون',status:count>0?'READY':'BLOCKED',detail:count>0?`${count} مستخدم نشط`:'لا يوجد مستخدم نشط للشركة.'};}),
   run('roles','الأدوار والصلاحيات',async()=>{const rows=(await client.list('roles',ctx)).filter(isRecord);return{id:'roles',label:'الأدوار والصلاحيات',status:rows.length>0?'READY':'BLOCKED',detail:rows.length>0?`${rows.length} دور معرف`:'يجب تعريف دور واحد على الأقل.'};}),
   run('locale','الإعدادات الأساسية',async()=>{const value=configValue(await client.read('configuration/locale',ctx));return{id:'locale',label:'الإعدادات الأساسية',status:configured(value)?'READY':'BLOCKED',detail:configured(value)?`اللغة/المنطقة: ${String(value)}`:'إعداد اللغة/المنطقة غير محفوظ.'};}),
   run('identity','هوية الشركة والمستندات',async()=>{identityValue=configValue(await client.read('configuration/documentIdentity',ctx));const value=identityFrom(identityValue);setIdentity(value);const ok=[value.legalName,value.phone,value.taxRegistration,value.commercialRegistration].every(configured);return{id:'identity',label:'هوية الشركة والمستندات',status:ok?'READY':'BLOCKED',detail:ok?'البيانات القانونية وبيانات الطباعة الأساسية محفوظة.':'أكمل الاسم القانوني والهاتف والرقم الضريبي والسجل التجاري.'};}),
   run('diagnostics','صحة قاعدة البيانات',async()=>{const data=diagnostic(await client.read('operations/diagnostics',ctx));return{id:'diagnostics',label:'صحة قاعدة البيانات',status:data.database==='AVAILABLE'?'READY':'BLOCKED',detail:data.database==='AVAILABLE'?'قاعدة البيانات متاحة.':'قاعدة البيانات غير متاحة أو لم يتم التحقق منها.'};}),
   run('schema','توافق قاعدة البيانات',async()=>{const data=diagnostic(await client.read('operations/diagnostics',ctx));return{id:'schema',label:'توافق قاعدة البيانات',status:data.schemaCompatibility==='CURRENT'?'READY':'BLOCKED',detail:data.schemaCompatibility==='CURRENT'?'المخطط الحالي متوافق.':`الحالة: ${String(data.schemaCompatibility??'غير معروفة')}`};}),
   run('backup','النسخ الاحتياطي والاسترجاع',async()=>{const data=diagnostic(await client.read('operations/diagnostics',ctx));const ok=data.backupProvider==='AVAILABLE'&&data.restoreReady===true;return{id:'backup',label:'النسخ الاحتياطي والاسترجاع',status:ok?'READY':'BLOCKED',detail:ok?'موفر النسخ والاسترجاع جاهزان.':`النسخ: ${String(data.backupProvider??'غير معروف')} · الاسترجاع: ${data.restoreReady===true?'جاهز':'غير جاهز'}`};}),
   run('maintenance','وضع التشغيل',async()=>{const data=diagnostic(await client.read('operations/diagnostics',ctx));return{id:'maintenance',label:'وضع التشغيل',status:data.maintenance===false?'READY':'BLOCKED',detail:data.maintenance===false?'النظام متاح للتشغيل الطبيعي.':'النظام في وضع الصيانة أو الحالة غير معروفة.'};})
  ]);
  if(identityValue!==undefined)setIdentity(identityFrom(identityValue));
  setChecks(next);setLoading(false);
 }

 async function saveIdentity(event:FormEvent){event.preventDefault();setLoading(true);setError('');setNotice('');try{await client.action('configuration/documentIdentity',ctx,{value:identity});setNotice('تم حفظ هوية الشركة والطباعة في مصدر الإعدادات المركزي.');await load();}catch(cause){setError(cause instanceof Error?cause.message:'تعذر حفظ هوية الشركة.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[ctx.token,ctx.companyId,ctx.branchId]);
 const summary=useMemo(()=>({ready:checks.filter(item=>item.status==='READY').length,blocked:checks.filter(item=>item.status==='BLOCKED').length,unknown:checks.filter(item=>item.status==='UNKNOWN').length,total:checks.length}),[checks]);
 const marketReady=summary.total>0&&summary.blocked===0&&summary.unknown===0;
 const field=(key:keyof DocumentIdentity,label:string,type='text')=><FormField label={label}><Input type={type} value={identity[key]} onChange={event=>setIdentity(current=>({...current,[key]:event.target.value}))}/></FormField>;

 if(!ctx.token)return <ErrorState message="يلزم تسجيل الدخول للتحقق من جاهزية الشركة."/>;
 return <section dir="rtl" className="ui-page-stack" aria-label="الإعداد والتشغيل">
  <Card title="الإعداد والتشغيل"><p>مركز واحد لتهيئة الشركة، دليل البدء وفحص الجاهزية. يعتمد على الـOwners الحالية ولا ينشئ قاعدة بيانات أو إعدادات موازية.</p></Card>
  <Tabs tabs={[{id:'readiness',label:'جاهزية البيع والتشغيل'},{id:'guide',label:'دليل البدء السريع'},{id:'identity',label:'هوية الشركة والطباعة'}]} active={tab} onChange={id=>setTab(id as Tab)}/>
  {notice?<Toast tone="success">{notice}</Toast>:null}{error?<ErrorState message={error}/>:null}
  {tab==='readiness'?<>
   <Card><div className="ui-action-bar"><strong>{marketReady?'جاهز للتشغيل':'يحتاج استكمال'}</strong><Badge tone={marketReady?'success':'warning'}>جاهز {summary.ready} / {summary.total}</Badge><span>يحتاج إجراء: {summary.blocked}</span><span>تعذر التحقق: {summary.unknown}</span><Button type="button" variant="secondary" onClick={()=>void load()} disabled={loading}>إعادة الفحص</Button></div></Card>
   {loading&&checks.length===0?<LoadingState/>:<div className="ui-grid-cards">{checks.map(item=><Card key={item.id}><div className="readiness-check"><strong>{item.label}</strong><Badge tone={item.status==='READY'?'success':item.status==='BLOCKED'?'warning':'neutral'}>{item.status==='READY'?'جاهز':item.status==='BLOCKED'?'يحتاج إجراء':'تعذر التحقق'}</Badge><p>{item.detail}</p></div></Card>)}</div>}
  </>:null}
  {tab==='guide'?<div className="ui-grid-cards">{guide.map(item=><Card key={item.title} title={item.title}><p>{item.detail}</p><a className="ui-button ui-button--secondary" href={item.href}>فتح الخطوة</a></Card>)}</div>:null}
  {tab==='identity'?<form onSubmit={saveIdentity} className="ui-page-stack">
   <Card title="البيانات القانونية وبيانات الاتصال"><div className="admin-actions">{field('legalName','الاسم القانوني')}{field('commercialRegistration','السجل التجاري')}{field('taxRegistration','الرقم الضريبي')}{field('phone','الهاتف','tel')}{field('email','البريد الإلكتروني','email')}{field('address','العنوان')}{field('website','الموقع الإلكتروني','url')}</div></Card>
   <Card title="هوية المستند والتوقيعات"><div className="admin-actions">{field('logoFileId','الشعار من مركز الملفات (اختياري)')}{field('accountant','المحاسب')}{field('reviewer','المراجع')}{field('approver','المعتمد')}</div><p>يُحفظ مرجع الشعار فقط؛ الملف نفسه يظل مملوكًا لمركز الملفات ولا يتم نسخه.</p></Card>
   <Button type="submit" disabled={loading}>حفظ هوية الشركة والطباعة</Button>
  </form>:null}
 </section>;
}
