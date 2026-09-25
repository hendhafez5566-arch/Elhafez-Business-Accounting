import {type FormEvent,useEffect,useState} from 'react';
import {AppShell} from './app-shell.js';
import {apiUrl} from './api-url.js';
import {clearTenantSession,loadTenantSession,saveTenantSession,TENANT_SESSION_EVENT,type TenantSession} from './auth-session.js';
import {Button,Card,ErrorState,FormField,Input,Select} from './ui.js';

interface Branch{readonly id:string;readonly name:string;readonly active:boolean}
interface LoginResponse{
 readonly token:string;readonly userId:string;readonly expiresAt:string;
 readonly companyId:string;readonly companyCode:string;readonly companyName:string;
 readonly branches:readonly Branch[];readonly defaultBranchId:string;
 readonly subscription:{readonly status:string;readonly allowed:boolean;readonly reason:string|null};
}
async function json<T>(path:string,init:RequestInit):Promise<T>{
 const response=await fetch(apiUrl(path),{...init,headers:{'content-type':'application/json',...init.headers}});
 const payload=await response.json().catch(()=>({})) as {message?:string;code?:string};
 if(!response.ok)throw new Error(payload.message??payload.code??'تعذر تنفيذ الطلب');
 return payload as T;
}
export async function tenantLogin(input:{companyCode:string;email:string;password:string}){
 return json<LoginResponse>('/saas/login',{method:'POST',body:JSON.stringify(input)});
}
export async function tenantLogout(session:TenantSession){
 try{await json('/saas/logout',{method:'POST',headers:{authorization:`Bearer ${session.token}`,'x-company-id':session.companyId},body:'{}'});}finally{clearTenantSession();}
}
export async function requestRecovery(email:string){
 return json('/system-administration/recovery/request',{method:'POST',body:JSON.stringify({email})});
}
export async function resetPassword(token:string,password:string){
 return json('/system-administration/recovery/reset',{method:'POST',body:JSON.stringify({token,password})});
}

function sessionFrom(login:LoginResponse,branchId:string):TenantSession{
 const branch=login.branches.find(value=>value.id===branchId);
 if(!branch)throw new Error('الفرع غير متاح لهذا المستخدم');
 return{token:login.token,userId:login.userId,expiresAt:login.expiresAt,companyId:login.companyId,companyCode:login.companyCode,companyName:login.companyName,branchId:branch.id,branchName:branch.name,subscriptionStatus:login.subscription.status,subscriptionAllowed:login.subscription.allowed};
}

export function TenantApplication({pathname}:{readonly pathname:string}){
 const[session,setSession]=useState<TenantSession|null>(()=>loadTenantSession());
 useEffect(()=>{const sync=()=>setSession(loadTenantSession());window.addEventListener(TENANT_SESSION_EVENT,sync);return()=>window.removeEventListener(TENANT_SESSION_EVENT,sync);},[]);
 if(!session)return <TenantEntry onAuthenticated={setSession}/>;
 if(!session.subscriptionAllowed)return <main className="tenant-entry-shell" dir="rtl"><Card title="اشتراك الشركة غير نشط"><p>تم التحقق من الحساب، لكن الاشتراك الحالي لا يسمح باستخدام النظام الآن.</p><p><strong>الحالة:</strong> {session.subscriptionStatus}</p><Button variant="secondary" onClick={()=>void tenantLogout(session)}>تسجيل الخروج</Button></Card></main>;
 return <AppShell pathname={pathname} preferenceScope={session.userId} companyLabel={session.companyName||session.companyCode} branchLabel={session.branchName} onLogout={()=>void tenantLogout(session)}/>;
}

function TenantEntry({onAuthenticated}:{readonly onAuthenticated:(session:TenantSession)=>void}){
 const params=typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);
 const recoveryToken=params.get('recoveryToken')??'';
 const[mode,setMode]=useState<'login'|'recovery-request'|'recovery-reset'>(recoveryToken?'recovery-reset':'login');
 const[companyCode,setCompanyCode]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const[pending,setPending]=useState<LoginResponse|null>(null),[branchId,setBranchId]=useState('');
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');

 async function submitLogin(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{const result=await tenantLogin({companyCode,email,password});setPassword('');if(result.branches.length===1){const session=sessionFrom(result,result.defaultBranchId);saveTenantSession(session);onAuthenticated(session);}else{setPending(result);setBranchId(result.defaultBranchId);}}catch(value){setError(value instanceof Error?value.message:'تعذر تسجيل الدخول');}finally{setBusy(false);}}
 function enterBranch(){if(!pending)return;try{const session=sessionFrom(pending,branchId);saveTenantSession(session);onAuthenticated(session);}catch(value){setError(value instanceof Error?value.message:'تعذر اختيار الفرع');}}
 async function recover(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await requestRecovery(email);setMessage('إذا كان البريد مسجلاً فستصلك تعليمات استعادة كلمة المرور.');}catch{setMessage('إذا كان البريد مسجلاً فستصلك تعليمات استعادة كلمة المرور.');}finally{setBusy(false);}}
 async function reset(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await resetPassword(recoveryToken,password);setPassword('');setMessage('تم تعيين كلمة المرور. يمكنك تسجيل الدخول الآن.');setMode('login');if(typeof history!=='undefined')history.replaceState({},'',location.pathname);}catch(value){setError(value instanceof Error?value.message:'تعذر تعيين كلمة المرور');}finally{setBusy(false);}}

 return <main className="tenant-entry-shell" dir="rtl"><section className="tenant-entry-card">
  <div className="tenant-entry-brand">ELHAFEZ TECHNOLOGY</div>
  {pending?<><h1>اختر الفرع</h1><p>{pending.companyName} — {pending.companyCode}</p><FormField label="الفرع" required><Select value={branchId} onChange={event=>setBranchId(event.target.value)}>{pending.branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></FormField>{error&&<ErrorState message={error}/>}<Button onClick={enterBranch}>دخول للنظام</Button><Button variant="secondary" onClick={()=>setPending(null)}>رجوع</Button></>
  :mode==='login'?<form onSubmit={submitLogin}><h1>تسجيل الدخول</h1><p>أدخل كود الشركة وبيانات حسابك. الشركة والفرع يتم التحقق منهما من السيرفر.</p><FormField label="Company Code" required><Input autoComplete="organization" required value={companyCode} onChange={event=>setCompanyCode(event.target.value.toUpperCase())}/></FormField><FormField label="البريد الإلكتروني" required><Input type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)}/></FormField><FormField label="كلمة المرور" required><Input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/></FormField>{error&&<ErrorState message={error}/>}<Button type="submit" loading={busy}>دخول</Button><Button type="button" variant="secondary" onClick={()=>{setMode('recovery-request');setError('');setMessage('');}}>نسيت كلمة المرور</Button></form>
  :mode==='recovery-request'?<form onSubmit={recover}><h1>استعادة كلمة المرور</h1><p>سنرسل رابطًا قصير الصلاحية إذا كان البريد مسجلاً.</p><FormField label="البريد الإلكتروني" required><Input type="email" required value={email} onChange={event=>setEmail(event.target.value)}/></FormField>{message&&<p role="status">{message}</p>}{error&&<ErrorState message={error}/>}<Button type="submit" loading={busy}>إرسال تعليمات الاستعادة</Button><Button type="button" variant="secondary" onClick={()=>setMode('login')}>العودة للدخول</Button></form>
  :<form onSubmit={reset}><h1>تعيين كلمة مرور جديدة</h1><FormField label="كلمة المرور الجديدة" required hint="12 حرفًا على الأقل"><Input type="password" minLength={12} autoComplete="new-password" required value={password} onChange={event=>setPassword(event.target.value)}/></FormField>{message&&<p role="status">{message}</p>}{error&&<ErrorState message={error}/>}<Button type="submit" loading={busy}>حفظ كلمة المرور</Button></form>}
 </section></main>;
}
