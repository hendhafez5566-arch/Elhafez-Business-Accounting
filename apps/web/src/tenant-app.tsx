import{type FormEvent,useEffect,useMemo,useState}from'react';
import{AppShell}from'./app-shell.js';
import{browserPathname}from'./app-entry-path.js';
import{TenantAuthClient}from'./tenant-auth-client.js';
import{clearTenantSession,readTenantSession,selectTenantBranch,TENANT_SESSION_EVENT,type TenantSession,writeTenantSession}from'./tenant-session.js';
import{Button,Card,EmptyState,FormField,Input,Toast}from'./ui.js';

export function TenantApplication({client=new TenantAuthClient()}:{client?:TenantAuthClient}={}){
 const[session,setSession]=useState<TenantSession|null>(()=>readTenantSession());
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const sync=()=>setSession(readTenantSession());window.addEventListener(TENANT_SESSION_EVENT,sync);return()=>window.removeEventListener(TENANT_SESSION_EVENT,sync);},[]);
 async function logout(){const current=readTenantSession();clearTenantSession();setSession(null);if(current)await client.logout(current.token);}
 if(!session)return <TenantLogin client={client} busy={busy} setBusy={setBusy} error={error} setError={setError} onSuccess={value=>{writeTenantSession(value);setSession(value);}}/>;
 if(session.mustChangePassword)return <InitialPasswordChange client={client} session={session} onChanged={value=>{writeTenantSession(value);setSession(value);}} onLogout={()=>void logout()}/>;
 if(!session.subscription.allowed)return <main className="tenant-entry-shell" dir="rtl"><section className="tenant-entry-panel"><div className="tenant-entry-panel__top"><div className="tenant-entry-panel__mark">ح</div><span className="tenant-entry-panel__eyebrow">ELHAFEZ TECHNOLOGY</span><h2 className="tenant-entry-panel__title">منصة الحافظ لإدارة الأعمال</h2></div></section><section className="tenant-entry-form-side"><Card title="الاشتراك غير متاح"><EmptyState title="لا يمكن فتح النظام حاليًا"><p>حالة الاشتراك: <strong>{session.subscription.status}</strong></p><p>{session.subscription.reason??'يرجى التواصل مع إدارة المنصة لتجديد أو تفعيل الاشتراك.'}</p><Button type="button" onClick={()=>void logout()}>تسجيل الخروج</Button></EmptyState></Card></section></main>;
 const branch=session.branches.find(value=>value.id===session.branchId);
 return <AppShell pathname={browserPathname()} preferenceScope={session.userId} companyLabel={session.companyName} branchLabel={branch?.name??session.branchId} branches={session.branches.map(value=>({id:value.id,name:value.name}))} branchId={session.branchId} onBranchChange={branchId=>{const next=selectTenantBranch(branchId);setSession(next);}} onLogout={()=>void logout()} sessionKey={session.companyId+':'+session.branchId}/>;
}

export function TenantLogin({client,busy,setBusy,error,setError,onSuccess}:{client:TenantAuthClient;busy:boolean;setBusy:(value:boolean)=>void;error:string;setError:(value:string)=>void;onSuccess:(value:TenantSession)=>void}){
 const[companyCode,setCompanyCode]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState('');
 const normalized=useMemo(()=>companyCode.trim().toUpperCase(),[companyCode]);
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{onSuccess(await client.login({companyCode:normalized,username:username.trim(),password}));setPassword('');}catch(value){setError(value instanceof Error?value.message:'تعذر تسجيل الدخول.');}finally{setBusy(false);}}
 return <main className="tenant-entry-shell" dir="rtl">
  <section className="tenant-entry-panel">
   <div className="tenant-entry-panel__top">
    <div className="tenant-entry-panel__mark">ح</div>
    <span className="tenant-entry-panel__eyebrow">ELHAFEZ TECHNOLOGY</span>
    <h2 className="tenant-entry-panel__title">منصة الحافظ لإدارة الأعمال</h2>
    <p className="tenant-entry-panel__lede">نظام واحد يجمع المحاسبة، الحج والعمرة، السياحة، والمبيعات لإدارة شركتك من مكان واحد.</p>
   </div>
   <ul className="tenant-entry-panel__features">
    <li className="tenant-entry-panel__feature"><span className="tenant-entry-panel__feature-index">01</span><div><b>محاسبة متكاملة</b><span>دفتر أستاذ، فروع، وتقارير مالية لحظية.</span></div></li>
    <li className="tenant-entry-panel__feature"><span className="tenant-entry-panel__feature-index">02</span><div><b>عمليات الحج والعمرة</b><span>حجوزات، تراخيص، وإدارة المعتمرين في مكان واحد.</span></div></li>
    <li className="tenant-entry-panel__feature"><span className="tenant-entry-panel__feature-index">03</span><div><b>مبيعات وعملاء</b><span>عروض أسعار ومتابعة عملاء بلا تشتت.</span></div></li>
   </ul>
  </section>
  <section className="tenant-entry-form-side">
   <form className="tenant-entry-card" onSubmit={submit}>
    <div className="tenant-entry-brand">تسجيل الدخول</div><h1>أهلًا بعودتك</h1><p>أدخل كود الشركة واسم المستخدم وكلمة المرور.</p>
    <FormField label="كود الشركة" required><Input required autoCapitalize="characters" autoComplete="organization" value={companyCode} onChange={event=>setCompanyCode(event.target.value.toUpperCase())} placeholder="ELH-XXXX"/></FormField>
    <FormField label="اسم المستخدم" required><Input required autoCapitalize="none" autoComplete="username" minLength={3} maxLength={40} value={username} onChange={event=>setUsername(event.target.value)} placeholder="مثال: manager"/></FormField>
    <FormField label="كلمة المرور" required><Input required type="password" autoComplete="current-password" minLength={12} value={password} onChange={event=>setPassword(event.target.value)}/></FormField>
    {error?<Toast tone="error">{error}</Toast>:null}
    <Button type="submit" disabled={busy||!normalized}>{busy?'جارٍ التحقق…':'دخول'}</Button>
    <p className="tenant-entry-note">اسم المستخدم خاص بالشركة ويمكن تغييره لاحقًا من إعدادات الحساب.</p>
   </form>
  </section>
 </main>;
}

function InitialPasswordChange({client,session,onChanged,onLogout}:{client:TenantAuthClient;session:TenantSession;onChanged:(value:TenantSession)=>void;onLogout:()=>void}){
 const[username,setUsername]=useState(session.username),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent){event.preventDefault();setError('');if(password!==confirm){setError('كلمتا المرور غير متطابقتين.');return;}setBusy(true);try{const nextUsername=username.trim();const result=await client.initialPassword(session.token,session.companyId,password,nextUsername===session.username?undefined:nextUsername);onChanged({...session,username:result.username,mustChangePassword:false});setPassword('');setConfirm('');}catch(value){setError(value instanceof Error?value.message:'تعذر تغيير بيانات الدخول.');}finally{setBusy(false);}}
 return <main className="tenant-entry-shell" dir="rtl">
  <section className="tenant-entry-panel"><div className="tenant-entry-panel__top"><div className="tenant-entry-panel__mark">ح</div><span className="tenant-entry-panel__eyebrow">ELHAFEZ TECHNOLOGY</span><h2 className="tenant-entry-panel__title">خطوة أخيرة قبل البدء</h2><p className="tenant-entry-panel__lede">تأمين حسابك بكلمة مرور جديدة يحمي بيانات شركتك المالية.</p></div></section>
  <section className="tenant-entry-form-side">
   <form className="tenant-entry-card" onSubmit={submit}><div className="tenant-entry-brand">تأكيد الدخول</div><h1>تأكيد بيانات الدخول لأول مرة</h1><p>يمكنك الاحتفاظ باسم المستخدم الذي استلمته أو تغييره الآن. يجب اختيار كلمة مرور جديدة قبل فتح النظام.</p><FormField label="اسم المستخدم" required><Input required autoCapitalize="none" autoComplete="username" minLength={3} maxLength={40} value={username} onChange={event=>setUsername(event.target.value)}/></FormField><FormField label="كلمة المرور الجديدة" required><Input required type="password" autoComplete="new-password" minLength={12} value={password} onChange={event=>setPassword(event.target.value)}/></FormField><FormField label="تأكيد كلمة المرور" required><Input required type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={event=>setConfirm(event.target.value)}/></FormField>{error?<Toast tone="error">{error}</Toast>:null}<Button type="submit" disabled={busy}>{busy?'جارٍ الحفظ…':'حفظ وفتح النظام'}</Button><Button type="button" variant="secondary" onClick={onLogout}>تسجيل الخروج</Button><p className="tenant-entry-note">السيرفر يمنع استخدام باقي النظام حتى إكمال هذه الخطوة.</p></form>
  </section>
 </main>;
}