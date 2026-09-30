import{type FormEvent,useEffect,useState}from'react';
import{AppShell}from'./app-shell.js';
import{browserPathname}from'./app-entry-path.js';
import{TenantAuthClient}from'./tenant-auth-client.js';
import{clearTenantSession,readTenantSession,selectTenantBranch,TENANT_SESSION_EVENT,type TenantSession,writeTenantSession}from'./tenant-session.js';
import{Button,Card,EmptyState,FormField,Input,Toast}from'./ui.js';

const PREVIEW_COMPANY_CODE='ELH-DEMO-0001';

export function TenantApplication({client=new TenantAuthClient()}:{client?:TenantAuthClient}={}){
 const[session,setSession]=useState<TenantSession|null>(()=>readTenantSession());
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const sync=()=>setSession(readTenantSession());window.addEventListener(TENANT_SESSION_EVENT,sync);return()=>window.removeEventListener(TENANT_SESSION_EVENT,sync);},[]);
 async function logout(){const current=readTenantSession();clearTenantSession();setSession(null);if(current)await client.logout(current.token);}
 if(!session)return <TenantLogin client={client} busy={busy} setBusy={setBusy} error={error} setError={setError} onSuccess={value=>{writeTenantSession(value);setSession(value);}}/>;
 if(session.mustChangePassword)return <InitialPasswordChange client={client} session={session} onChanged={value=>{writeTenantSession(value);setSession(value);}} onLogout={()=>void logout()}/>;
 if(!session.subscription.allowed)return <main className="tenant-entry-shell" dir="rtl"><Card title="الاشتراك غير متاح"><EmptyState title="لا يمكن فتح النظام حاليًا"><p>حالة الاشتراك: <strong>{session.subscription.status}</strong></p><p>{session.subscription.reason??'يرجى التواصل مع إدارة المنصة لتجديد أو تفعيل الاشتراك.'}</p><Button type="button" onClick={()=>void logout()}>تسجيل الخروج</Button></EmptyState></Card></main>;
 const branch=session.branches.find(value=>value.id===session.branchId);
 return <AppShell pathname={browserPathname()} preferenceScope={session.userId} companyLabel={session.companyName} branchLabel={branch?.name??session.branchId} branches={session.branches.map(value=>({id:value.id,name:value.name}))} branchId={session.branchId} onBranchChange={branchId=>{const next=selectTenantBranch(branchId);setSession(next);}} onLogout={()=>void logout()} sessionKey={session.companyId+':'+session.branchId}/>;
}

function TenantLogin({client,busy,setBusy,error,setError,onSuccess}:{client:TenantAuthClient;busy:boolean;setBusy:(value:boolean)=>void;error:string;setError:(value:string)=>void;onSuccess:(value:TenantSession)=>void}){
 const[username,setUsername]=useState('admin'),[password,setPassword]=useState('admin123');
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{onSuccess(await client.login({companyCode:PREVIEW_COMPANY_CODE,username:username.trim(),password}));}catch(value){setError(value instanceof Error?value.message:'تعذر تسجيل الدخول.');}finally{setBusy(false);}}
 return <main className="tenant-entry-shell" dir="rtl"><form className="tenant-entry-card" onSubmit={submit}>
  <div className="tenant-entry-brand">ELHAFEZ TECHNOLOGY</div><h1>نسخة تجربة النظام</h1><p>بيانات الدخول التجريبية جاهزة. اضغط دخول لمراجعة التصميم والوظائف.</p>
  <FormField label="اسم المستخدم" required><Input required autoCapitalize="none" autoComplete="username" minLength={3} maxLength={40} value={username} onChange={event=>setUsername(event.target.value)}/></FormField>
  <FormField label="كلمة المرور" required><Input required type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/></FormField>
  {error?<Toast tone="error">{error}</Toast>:null}
  <Button type="submit" disabled={busy||!username.trim()||!password}>{busy?'جارٍ الدخول…':'دخول النسخة التجريبية'}</Button>
  <p className="tenant-entry-note">هذه بيانات تجربة فقط وليست إعدادات الإنتاج.</p>
 </form></main>;
}

function InitialPasswordChange({client,session,onChanged,onLogout}:{client:TenantAuthClient;session:TenantSession;onChanged:(value:TenantSession)=>void;onLogout:()=>void}){
 const[username,setUsername]=useState(session.username),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent){event.preventDefault();setError('');if(password!==confirm){setError('كلمتا المرور غير متطابقتين.');return;}setBusy(true);try{const nextUsername=username.trim();const result=await client.initialPassword(session.token,session.companyId,password,nextUsername===session.username?undefined:nextUsername);onChanged({...session,username:result.username,mustChangePassword:false});setPassword('');setConfirm('');}catch(value){setError(value instanceof Error?value.message:'تعذر تغيير بيانات الدخول.');}finally{setBusy(false);}}
 return <main className="tenant-entry-shell" dir="rtl"><form className="tenant-entry-card" onSubmit={submit}><div className="tenant-entry-brand">ELHAFEZ TECHNOLOGY</div><h1>تأكيد بيانات الدخول لأول مرة</h1><p>يمكنك الاحتفاظ باسم المستخدم الذي استلمته أو تغييره الآن. يجب اختيار كلمة مرور جديدة قبل فتح النظام.</p><FormField label="اسم المستخدم" required><Input required autoCapitalize="none" autoComplete="username" minLength={3} maxLength={40} value={username} onChange={event=>setUsername(event.target.value)}/></FormField><FormField label="كلمة المرور الجديدة" required><Input required type="password" autoComplete="new-password" minLength={12} value={password} onChange={event=>setPassword(event.target.value)}/></FormField><FormField label="تأكيد كلمة المرور" required><Input required type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={event=>setConfirm(event.target.value)}/></FormField>{error?<Toast tone="error">{error}</Toast>:null}<Button type="submit" disabled={busy}>{busy?'جارٍ الحفظ…':'حفظ وفتح النظام'}</Button><Button type="button" variant="secondary" onClick={onLogout}>تسجيل الخروج</Button><p className="tenant-entry-note">السيرفر يمنع استخدام باقي النظام حتى إكمال هذه الخطوة.</p></form></main>;
}
