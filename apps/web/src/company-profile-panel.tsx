import{useEffect,useState}from'react';
import{Button,FormField,Input,Select}from'./ui.js';
import type{AdministrationClient,AdministrationContext}from'./system-administration-client.js';
import{CompanyProfileValidationError,DATE_FORMAT_OPTIONS,LOCALE_OPTIONS,TIMEZONE_OPTIONS,emptyCompanyProfileForm,loadCompanyProfile,operationsStatusRows,saveCompanyProfile,withCurrentOption,type CompanyProfileForm,type Option,type StatusRow}from'./company-profile-model.js';

export function CompanyProfilePanel({client,context}:{client:AdministrationClient;context:AdministrationContext}){
 const[form,setForm]=useState<CompanyProfileForm>(emptyCompanyProfileForm),[initial,setInitial]=useState<CompanyProfileForm>(emptyCompanyProfileForm),[status,setStatus]=useState<readonly StatusRow[]>([]),[diagnosticsFailed,setDiagnosticsFailed]=useState(false),[busy,setBusy]=useState(false),[errors,setErrors]=useState<readonly string[]>([]),[notice,setNotice]=useState('');
 const set=(name:keyof CompanyProfileForm,value:string)=>setForm(current=>({...current,[name]:value}));
 async function load(){const loaded=await loadCompanyProfile(client,context);setForm(loaded);setInitial(loaded);try{setStatus(operationsStatusRows(await client.read('operations/diagnostics',context),loaded.retentionDays));setDiagnosticsFailed(false);}catch{setStatus(operationsStatusRows(undefined,loaded.retentionDays));setDiagnosticsFailed(true);}}
 useEffect(()=>{if(context.token)void load();},[context.token,context.companyId,context.branchId]);
 async function save(){if(busy)return;setBusy(true);setErrors([]);setNotice('');try{const result=await saveCompanyProfile(client,context,form,initial);setNotice(result.saved.length?'تم حفظ إعدادات الشركة.':'لا توجد تغييرات للحفظ.');await load();}catch(error){setErrors(error instanceof CompanyProfileValidationError?error.errors:['تعذر حفظ الإعدادات. تحقق من صلاحياتك ثم أعد المحاولة.']);}finally{setBusy(false);}}
 const text=(name:keyof CompanyProfileForm,label:string,required=false)=><FormField label={label} required={required}><Input value={form[name]} onChange={event=>set(name,event.target.value)}/></FormField>;
 const choose=(name:keyof CompanyProfileForm,label:string,options:readonly Option[])=><FormField label={label}><Select value={form[name]} onChange={event=>set(name,event.target.value)}><option value="">غير محدد</option>{withCurrentOption(options,form[name]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</Select></FormField>;
 return <div className="admin-actions">
  <h3>هوية الشركة والإعدادات العامة</h3>{text('name','اسم الشركة',true)}{text('address','العنوان')}{text('phone','الهاتف')}{text('email','البريد الإلكتروني')}{choose('locale','اللغة',LOCALE_OPTIONS)}{choose('timezone','المنطقة الزمنية',TIMEZONE_OPTIONS)}{choose('dateFormat','صيغة التاريخ',DATE_FORMAT_OPTIONS)}{text('retentionDays','مدة الاحتفاظ بالبيانات (بالأيام)')}
  {errors.length?<ul role="alert">{errors.map(message=><li key={message}>{message}</li>)}</ul>:null}{notice?<p role="status">{notice}</p>:null}<Button type="button" disabled={busy} onClick={()=>void save()}>{busy?'جارٍ الحفظ…':'حفظ الإعدادات'}</Button>
  <h3>حالة النظام والنسخ الاحتياطي</h3>{diagnosticsFailed?<p role="status">تعذر قراءة حالة النظام حاليًا. قد تحتاج صلاحية التشغيل.</p>:null}<ul>{status.map(row=><li key={row.key}><strong>{row.label}: </strong>{row.text}</li>)}</ul><p>استعادة النسخ الاحتياطية عملية حساسة تتم من مركز تحكم المالك بعد التحقق الإضافي، ولا تتوفر من هنا.</p>
  <h3>إعدادات الأعمال والمالية</h3><p>حدود الموافقات والخصومات تُدار من المالك المالي الحقيقي، ولا تُخزن كحقول على المستخدم.</p><p><a href="/management/approvals">فتح مركز الموافقات</a> · <a href="/accounting">فتح إعدادات المحاسبة والضرائب والعملات والفترات</a></p>
 </div>;
}
