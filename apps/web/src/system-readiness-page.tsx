import {useEffect,useMemo,useState} from 'react';
import {Button,Card,ErrorState,LoadingState} from './ui.js';
import {HttpAdministrationClient,type AdministrationClient,type AdministrationContext} from './system-administration-client.js';
import {tenantApiContext} from './tenant-session.js';

type ReadinessStatus='READY'|'BLOCKED'|'UNKNOWN';
type Check={id:string;label:string;status:ReadinessStatus;detail:string};
type Diagnostics={database?:unknown;backupProvider?:unknown;restoreReady?:unknown;maintenance?:unknown;schemaCompatibility?:unknown;runtimeVersion?:unknown};

function record(value:unknown):Record<string,unknown>|undefined{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;}
function active(value:Record<string,unknown>){return value.active!==false&&value.status!=='DISABLED'&&value.status!=='INACTIVE';}
function named(value:Record<string,unknown>){return typeof value.name==='string'&&value.name.trim().length>0;}
function diagnostic(value:unknown):Diagnostics{return record(value)??{};}
function configValue(value:unknown){const data=record(value);return data?.value;}
function configured(value:unknown){return value!==null&&value!==undefined&&String(value).trim().length>0;}
function unknown(id:string,label:string,error:unknown):Check{return{id,label,status:'UNKNOWN',detail:error instanceof Error?error.message:'تعذر التحقق من هذا البند.'};}

export function SystemReadinessPage({client=new HttpAdministrationClient(),context}:{client?:AdministrationClient;context?:AdministrationContext}={}){
 const ctx=context??tenantApiContext();
 const [checks,setChecks]=useState<readonly Check[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');

 async function load(){
  if(!ctx.token)return;
  setLoading(true);setError('');
  const next:Check[]=[];
  const run=async(id:string,label:string,operation:()=>Promise<Check>)=>{try{next.push(await operation());}catch(cause){next.push(unknown(id,label,cause));}};
  await Promise.all([
   run('company','بيانات الشركة',async()=>{const rows=(await client.list('companies',ctx)).filter(record);const company=rows.find(item=>item.id===ctx.companyId);return{id:'company',label:'بيانات الشركة',status:company&&named(company)&&active(company)?'READY':'BLOCKED',detail:company&&named(company)?String(company.name):'اسم الشركة أو حالة الشركة غير مكتملين.'};}),
   run('branch','الفرع الحالي',async()=>{const rows=(await client.list('branches',ctx)).filter(record);const branch=rows.find(item=>item.id===ctx.branchId);return{id:'branch',label:'الفرع الحالي',status:branch&&named(branch)&&active(branch)?'READY':'BLOCKED',detail:branch&&named(branch)?String(branch.name):'الفرع الحالي غير مهيأ أو غير نشط.'};}),
   run('users','المستخدمون',async()=>{const rows=(await client.list('users',ctx)).filter(record);const count=rows.filter(active).length;return{id:'users',label:'المستخدمون',status:count>0?'READY':'BLOCKED',detail:count>0?`${count} مستخدم نشط`:'لا يوجد مستخدم نشط للشركة.'};}),
   run('roles','الأدوار والصلاحيات',async()=>{const rows=(await client.list('roles',ctx)).filter(record);return{id:'roles',label:'الأدوار والصلاحيات',status:rows.length>0?'READY':'BLOCKED',detail:rows.length>0?`${rows.length} دور معرف`:'يجب تعريف دور واحد على الأقل.'};}),
   run('locale','الإعدادات الأساسية',async()=>{const value=configValue(await client.read('configuration/locale',ctx));return{id:'locale',label:'الإعدادات الأساسية',status:configured(value)?'READY':'BLOCKED',detail:configured(value)?`اللغة/المنطقة: ${String(value)}`:'إعداد اللغة/المنطقة غير محفوظ.'};}),
   run('diagnostics','صحة قاعدة البيانات',async()=>{const data=diagnostic(await client.read('operations/diagnostics',ctx));return{id:'diagnostics',label:'صحة قاعدة البيانات',status:data.database==='AVAILABLE'?'READY':'BLOCKED',detail:data.database==='AVAILABLE'?'قاعدة البيانات متاحة.':'قاعدة البيانات غير متاحة أو لم يتم التحقق منها.'};}),
   run('schema','توافق قاعدة البيانات',async()=>{const data=diagnostic(await client.read('operations/diagnostics',ctx));return{id:'schema',label:'توافق قاعدة البيانات',status:data.schemaCompatibility==='CURRENT'?'READY':'BLOCKED',detail:data.schemaCompatibility==='CURRENT'?'المخطط الحالي متوافق.':`الحالة: ${String(data.schemaCompatibility??'غير معروفة')}`};}),
   run('backup','النسخ الاحتياطي والاسترجاع',async()=>{const data=diagnostic(await client.read('operations/diagnostics',ctx));const ok=data.backupProvider==='AVAILABLE'&&data.restoreReady===true;return{id:'backup',label:'النسخ الاحتياطي والاسترجاع',status:ok?'READY':'BLOCKED',detail:ok?'موفر النسخ والاسترجاع جاهزان.':`النسخ: ${String(data.backupProvider??'غير معروف')} · الاسترجاع: ${data.restoreReady===true?'جاهز':'غير جاهز'}`};}),
   run('maintenance','وضع التشغيل',async()=>{const data=diagnostic(await client.read('operations/diagnostics',ctx));return{id:'maintenance',label:'وضع التشغيل',status:data.maintenance===false?'READY':'BLOCKED',detail:data.maintenance===false?'النظام متاح للتشغيل الطبيعي.':'النظام في وضع الصيانة أو الحالة غير معروفة.'};})
  ]);
  setChecks(next);
  setLoading(false);
 }

 useEffect(()=>{void load();},[ctx.token,ctx.companyId,ctx.branchId]);
 const summary=useMemo(()=>({ready:checks.filter(item=>item.status==='READY').length,blocked:checks.filter(item=>item.status==='BLOCKED').length,unknown:checks.filter(item=>item.status==='UNKNOWN').length,total:checks.length}),[checks]);
 const marketReady=summary.total>0&&summary.blocked===0&&summary.unknown===0;

 if(!ctx.token)return <ErrorState title="يلزم تسجيل الدخول" description="تعذر التحقق من جاهزية الشركة بدون جلسة صالحة."/>;
 return <div className="page-stack">
  <div className="page-heading"><div><h1>جاهزية البيع والتشغيل</h1><p>فحص قراءة فقط يعتمد على بيانات النظام الحالية ولا ينشئ مصدر بيانات مكررًا.</p></div><Button type="button" onClick={()=>void load()} disabled={loading}>إعادة الفحص</Button></div>
  {error&&<ErrorState title="تعذر فحص الجاهزية" description={error}/>}
  {loading&&checks.length===0?<LoadingState/>:<>
   <Card><div className="readiness-summary"><strong>{marketReady?'جاهز للتشغيل':'يحتاج استكمال'}</strong><span>جاهز: {summary.ready}</span><span>يحتاج إجراء: {summary.blocked}</span><span>تعذر التحقق: {summary.unknown}</span></div></Card>
   <div className="ui-grid-cards">{checks.map(item=><Card key={item.id}><div className="readiness-check"><strong>{item.label}</strong><span>{item.status==='READY'?'جاهز':item.status==='BLOCKED'?'يحتاج إجراء':'تعذر التحقق'}</span><p>{item.detail}</p></div></Card>)}</div>
  </>}
 </div>;
}
