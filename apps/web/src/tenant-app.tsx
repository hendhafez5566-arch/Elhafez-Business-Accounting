import{type FormEvent,useEffect,useMemo,useState}from'react';
import{AppShell}from'./app-shell.js';
import{browserPathname}from'./app-entry-path.js';
import{TenantAuthClient}from'./tenant-auth-client.js';
import{clearTenantSession,readTenantSession,selectTenantBranch,TENANT_SESSION_EVENT,type TenantSession,writeTenantSession}from'./tenant-session.js';
import{Button,Card,EmptyState,FormField,Input,Select,Toast}from'./ui.js';

export function TenantApplication({client=new TenantAuthClient()}:{client?:TenantAuthClient}={}){
 const[session,setSession]=useState<TenantSession|null>(()=>readTenantSession());
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const sync=()=>setSession(readTenantSession());window.addEventListener(TENANT_SESSION_EVENT,sync);return()=>window.removeEventListener(TENANT_SESSION_EVENT,sync);},[]);
 async function logout(){const current=readTenantSession();clearTenantSession();setSession(null);if(current)await client.logout(current.token);}
 if(!session)return <TenantLogin client={client} busy={busy} setBusy={setBusy} error={error} setError={setError} onSuccess={value=>{writeTenantSession(value);setSession(value);}}/>;
 if(!session.subscription.allowed)return <main className="tenant-entry-shell" dir="rtl"><Card title="الاشتراك غير متاح"><EmptyState title="لا يمكن فتح النظام حاليًا"><p>حالة الاشتراك: <strong>{session.subscription.status}</strong></p><p>{session.subscription.reason??'يرجى التواصل مع إدارة المنصة لتجديد أو تفعيل الاشتراك.'}</p><Button type="button" onClick={()=>void logout()}>تسجيل الخروج</Button></EmptyState></Card></main>;
 const branch=session.branches.find(value=>value.id===session.branchId);
 return <AppShell
  pathname={browserPathname()}
  preferenceScope={session.userId}
  companyLabel={session.companyCode}
  branchLabel={branch?.name??session.branchId}
  branches={session.branches.map(value=>({id:value.id,name:value.name}))}
  branchId={session.branchId}
  onBranchChange={id=>{const next=selectTenantBranch(id);setSession(next);}}
  onLogout={()=>void logout()}
  sessionKey={session.companyId+':'+session.branchId}
 />;
}

function TenantLogin({client,busy,setBusy,error,setError,onSuccess}:{client:TenantAuthClient;busy:boolean;setBusy:(v:boolean)=>void;error:string;setError:(v:string)=>void;onSuccess:(v:TenantSession)=>void}){
 const[companyCode,setCompanyCode]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const normalized=useMemo(()=>companyCode.trim().toUpperCase(),[companyCode]);
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{onSuccess(await client.login({companyCode:normalized,email:email.trim(),password}));setPassword('');}catch(value){setError(value instanceof Error?value.message:'تعذر تسجيل الدخول.');}finally{setBusy(false);}}
 return <main className="tenant-entry-shell" dir="rtl"><form className="tenant-entry-card" onSubmit={submit}>
  <div className="tenant-entry-brand">ELHAFEZ TECHNOLOGY</div><h1>منصة الحافظ لإدارة الأعمال</h1><p>أدخل كود الشركة وبيانات حسابك. يتم التحقق من الشركة والاشتراك من السيرفر.</p>
  <FormField label="كود الشركة" required><Input required autoCapitalize="characters" autoComplete="organization" value={companyCode} onChange={event=>setCompanyCode(event.target.value.toUpperCase())} placeholder="ELHAFEZ-XXXX"/></FormField>
  <FormField label="البريد الإلكتروني" required><Input required type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)}/></FormField>
  <FormField label="كلمة المرور" required><Input required type="password" autoComplete="current-password" minLength={12} value={password} onChange={event=>setPassword(event.target.value)}/></FormField>
  {error?<Toast tone="error">{error}</Toast>:null}
  <Button type="submit" disabled={busy||!normalized}>{busy?'جارٍ التحقق…':'دخول'}</Button>
  <p className="tenant-entry-note">الجلسة تحفظ داخل جلسة المتصفح الحالية فقط ولا يتم الاعتماد على ساعة جهازك لتحديد صلاحية الاشتراك.</p>
 </form></main>;
}
