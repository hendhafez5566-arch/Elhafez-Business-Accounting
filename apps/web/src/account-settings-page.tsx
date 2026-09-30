import{type FormEvent,useState}from'react';
import{TenantAuthClient}from'./tenant-auth-client.js';
import{readTenantSession,writeTenantSession}from'./tenant-session.js';
import{ActionBar,Badge,Button,Card,FormField,Input,MetricCard,Toast}from'./ui.js';

export function AccountSettingsPage({client=new TenantAuthClient()}:{client?:TenantAuthClient}={}){
 const session=readTenantSession();
 const[username,setUsername]=useState(session?.username??''),[currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState<{tone:'success'|'error';text:string}|null>(null);
 if(!session)return <section className="ui-dashboard"><Card title="بيانات الدخول"><p>يلزم تسجيل الدخول أولًا.</p></Card></section>;
 const activeSession=session;
 async function submit(event:FormEvent){event.preventDefault();setNotice(null);const normalized=username.trim();if(newPassword&&newPassword!==confirm){setNotice({tone:'error',text:'كلمتا المرور الجديدتان غير متطابقتين.'});return;}const usernameChanged=normalized!==activeSession.username;if(!usernameChanged&&!newPassword){setNotice({tone:'error',text:'لم يتم إدخال أي تغيير.'});return;}setBusy(true);try{const result=await client.updateCredentials(activeSession.token,activeSession.companyId,{currentPassword,newUsername:usernameChanged?normalized:undefined,newPassword:newPassword||undefined});writeTenantSession({...activeSession,username:result.username,mustChangePassword:false});setUsername(result.username);setCurrentPassword('');setNewPassword('');setConfirm('');setNotice({tone:'success',text:'تم تحديث بيانات الدخول بنجاح.'});}catch(error){setNotice({tone:'error',text:error instanceof Error?error.message:'تعذر تحديث بيانات الدخول.'});}finally{setBusy(false);}}
 return <section className="ui-dashboard" aria-label="إعدادات الحساب وبيانات الدخول">
  <div className="ui-metric-grid" aria-label="ملخص الحساب">
   <MetricCard label="اسم المستخدم" value={activeSession.username}/>
   <MetricCard label="حالة الجلسة" value="نشطة" tone="success"/>
   <MetricCard label="الشركة الحالية" value={activeSession.companyName}/>
   <MetricCard label="تغيير كلمة المرور" value={activeSession.mustChangePassword?'مطلوب':'غير مطلوب'} tone={activeSession.mustChangePassword?'warning':'success'}/>
  </div>
  <section className="ui-dashboard-grid" aria-label="بيانات الحساب والأمان">
   <Card title="هوية الحساب">
    <p><strong>اسم المستخدم الحالي</strong></p><p>{activeSession.username}</p>
    <p><strong>الشركة</strong></p><p>{activeSession.companyName}</p>
    <p><strong>الفرع النشط</strong></p><p>{activeSession.branches.find(branch=>branch.id===activeSession.branchId)?.name??activeSession.branchId}</p>
    <Badge tone="success">جلسة موثقة</Badge>
   </Card>
   <Card title="ضوابط الأمان">
    <p>أي تعديل على اسم المستخدم أو كلمة المرور يحتاج كلمة المرور الحالية، ويُحفظ مباشرة في حساب المستخدم الموثق.</p>
    <p>كلمة المرور الجديدة يجب أن تتكون من 12 حرفًا على الأقل.</p>
    <Badge tone={activeSession.mustChangePassword?'warning':'success'}>{activeSession.mustChangePassword?'يلزم تغيير كلمة المرور':'بيانات الدخول مستقرة'}</Badge>
   </Card>
  </section>
  <Card title="تعديل بيانات الدخول">
   <form onSubmit={submit} className="ui-filter-grid">
    <FormField label="اسم المستخدم"><Input required minLength={3} maxLength={40} autoCapitalize="none" autoComplete="username" value={username} onChange={event=>setUsername(event.target.value)}/></FormField>
    <FormField label="كلمة المرور الحالية" required><Input required type="password" autoComplete="current-password" minLength={12} value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/></FormField>
    <FormField label="كلمة مرور جديدة — اختياري"><Input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={event=>setNewPassword(event.target.value)}/></FormField>
    <FormField label="تأكيد كلمة المرور الجديدة"><Input type="password" autoComplete="new-password" minLength={newPassword?12:undefined} value={confirm} onChange={event=>setConfirm(event.target.value)}/></FormField>
    {notice?<Toast tone={notice.tone}>{notice.text}</Toast>:null}
    <ActionBar><Button type="submit" disabled={busy}>{busy?'جارٍ الحفظ…':'حفظ بيانات الدخول'}</Button></ActionBar>
   </form>
  </Card>
 </section>;
}
