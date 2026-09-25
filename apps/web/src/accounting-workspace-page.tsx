import{type FormEvent,useEffect,useState}from'react';
import{accountingApi,type AccountingCapabilities,type AccountingOverview,type AccountClassification}from'./accounting-client.js';
import{ActionBar,Badge,Button,Card,DataGrid,EmptyState,ErrorState,FormField,Input,LoadingState,MetricCard,Select,Tabs,Toast}from'./ui.js';

const emptyOverview:AccountingOverview={fiscalYears:[],periods:[],accounts:[],journals:[],invoices:[],treasuries:[],vouchers:[],reports:{trialBalance:{rows:[]},incomeStatement:{rows:[]},balanceSheet:{rows:[]},treasury:{totals:[]}}};
const classLabel:Record<AccountClassification,string>={ASSET:'أصول',LIABILITY:'التزامات',EQUITY:'حقوق ملكية',REVENUE:'إيرادات',EXPENSE:'مصروفات'};
const tabs=[{id:'overview',label:'نظرة عامة'},{id:'accounts',label:'دليل الحسابات'},{id:'journals',label:'القيود'},{id:'periods',label:'الفترات'},{id:'billing',label:'الذمم والفواتير'},{id:'treasury',label:'الخزائن والبنوك'},{id:'reports',label:'التقارير'}];

export function AccountingWorkspacePage(){
 const[data,setData]=useState<AccountingOverview>(emptyOverview),[cap,setCap]=useState<AccountingCapabilities>({read:false,operate:false}),[tab,setTab]=useState('overview'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function reload(){setLoading(true);setError('');try{const[c,o]=await Promise.all([accountingApi.capabilities(),accountingApi.overview()]);setCap(c);setData(o);}catch(value){setError(value instanceof Error?value.message:'تعذر تحميل المحاسبة.');}finally{setLoading(false);}}
 useEffect(()=>{void reload();},[]);
 if(loading)return <LoadingState/>;if(error)return <ErrorState message={error}/>;if(!cap.read)return <EmptyState title="لا توجد صلاحية للمحاسبة"/>;
 return <section dir="rtl" className="ui-page-stack">
  {notice?<Toast tone="success">{notice}</Toast>:null}
  <Card title="المحاسبة والمالية"><p>مساحة تشغيل موحدة تعتمد مباشرة على مصادر الحقيقة المحاسبية المعتمدة؛ لا تحتفظ بأي أرصدة أو قيود مكررة.</p><ActionBar><Button variant="secondary" onClick={()=>void reload()}>تحديث</Button></ActionBar></Card>
  <Tabs tabs={tabs} active={tab} onChange={setTab}/>
  {tab==='overview'?<Overview data={data}/>:null}
  {tab==='accounts'?<Accounts data={data} operate={cap.operate} done={async message=>{setNotice(message);await reload();}}/>:null}
  {tab==='journals'?<Journals data={data} operate={cap.operate} done={async message=>{setNotice(message);await reload();}}/>:null}
  {tab==='periods'?<Periods data={data} operate={cap.operate} done={async message=>{setNotice(message);await reload();}}/>:null}
  {tab==='billing'?<Billing data={data}/>:null}
  {tab==='treasury'?<Treasury data={data} operate={cap.operate} done={async message=>{setNotice(message);await reload();}}/>:null}
  {tab==='reports'?<Reports data={data}/>:null}
 </section>;
}

function Overview({data}:{data:AccountingOverview}){return <div className="ui-grid-md">
 <MetricCard label="الحسابات" value={data.accounts.length}/><MetricCard label="القيود" value={data.journals.length}/><MetricCard label="الفواتير المفتوحة" value={data.invoices.filter(x=>x.status==='POSTED'&&x.outstanding!=='0').length}/><MetricCard label="الخزائن والبنوك" value={data.treasuries.filter(x=>x.active).length}/>
</div>}

function Accounts({data,operate,done}:{data:AccountingOverview;operate:boolean;done:(message:string)=>Promise<void>}){
 const[form,setForm]=useState({code:'',name:'',classification:'ASSET' as AccountClassification,parentId:'',controlType:''});
 async function submit(e:FormEvent){e.preventDefault();await accountingApi.createAccount({...form,postable:true,...(form.parentId?{parentId:form.parentId}:{}),...(form.controlType?{controlType:form.controlType}:{})});setForm({code:'',name:'',classification:'ASSET',parentId:'',controlType:''});await done('تم إنشاء الحساب من خلال دفتر الأستاذ العام.');}
 return <><Card title="دليل الحسابات">{operate?<form className="ui-filter-grid" onSubmit={submit}><FormField label="الكود" required><Input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></FormField><FormField label="اسم الحساب" required><Input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></FormField><FormField label="التصنيف"><Select value={form.classification} onChange={e=>setForm({...form,classification:e.target.value as AccountClassification})}>{Object.entries(classLabel).map(([id,label])=><option key={id} value={id}>{label}</option>)}</Select></FormField><FormField label="الحساب الأب"><Input value={form.parentId} onChange={e=>setForm({...form,parentId:e.target.value})}/></FormField><Button type="submit">إنشاء حساب</Button></form>:null}</Card>
 <DataGrid columns={['الكود','الحساب','التصنيف','الحالة']}>{data.accounts.map(x=><tr key={x.id}><td>{x.code}</td><td>{x.name}</td><td>{classLabel[x.classification]}</td><td><Badge tone={x.active?'success':'neutral'}>{x.active?'نشط':'غير نشط'}</Badge></td></tr>)}</DataGrid></>;
}

function Journals({data,operate,done}:{data:AccountingOverview;operate:boolean;done:(message:string)=>Promise<void>}){
 const[form,setForm]=useState({commandKey:'',number:'',postingDate:'',debitAccount:'',creditAccount:'',amount:''});
 async function submit(e:FormEvent){e.preventDefault();await accountingApi.postManualJournal({commandKey:form.commandKey||crypto.randomUUID(),number:form.number,postingDate:form.postingDate,lines:[{accountId:form.debitAccount,debit:form.amount},{accountId:form.creditAccount,credit:form.amount}]});setForm({commandKey:'',number:'',postingDate:'',debitAccount:'',creditAccount:'',amount:''});await done('تم ترحيل القيد عبر General Ledger.');}
 return <><Card title="قيد يدوي متوازن">{operate?<form className="ui-filter-grid" onSubmit={submit}><FormField label="رقم القيد" required><Input required value={form.number} onChange={e=>setForm({...form,number:e.target.value})}/></FormField><FormField label="تاريخ الترحيل" required><Input required type="date" value={form.postingDate} onChange={e=>setForm({...form,postingDate:e.target.value})}/></FormField><FormField label="الحساب المدين" required><Select required value={form.debitAccount} onChange={e=>setForm({...form,debitAccount:e.target.value})}><option value="">اختر</option>{data.accounts.filter(x=>x.active&&x.postable).map(x=><option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}</Select></FormField><FormField label="الحساب الدائن" required><Select required value={form.creditAccount} onChange={e=>setForm({...form,creditAccount:e.target.value})}><option value="">اختر</option>{data.accounts.filter(x=>x.active&&x.postable).map(x=><option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}</Select></FormField><FormField label="المبلغ" required><Input required inputMode="decimal" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></FormField><Button type="submit">ترحيل القيد</Button></form>:null}</Card>
 <DataGrid columns={['الرقم','التاريخ','النوع','المصدر']}>{data.journals.map(x=><tr key={x.id}><td>{x.number}</td><td>{x.postingDate}</td><td>{x.kind}</td><td>{x.sourceType}</td></tr>)}</DataGrid></>;
}

function Periods({data,operate,done}:{data:AccountingOverview;operate:boolean;done:(message:string)=>Promise<void>}){
 const[year,setYear]=useState({startDate:'',endDate:''}),[period,setPeriod]=useState({fiscalYearId:'',startDate:'',endDate:''});
 async function addYear(e:FormEvent){e.preventDefault();await accountingApi.createFiscalYear(year);setYear({startDate:'',endDate:''});await done('تم إنشاء السنة المالية.');}
 async function addPeriod(e:FormEvent){e.preventDefault();await accountingApi.createPeriod(period);setPeriod({fiscalYearId:'',startDate:'',endDate:''});await done('تم إنشاء الفترة المحاسبية.');}
 return <><div className="ui-grid-md">{operate?<Card title="سنة مالية"><form onSubmit={addYear}><FormField label="من"><Input required type="date" value={year.startDate} onChange={e=>setYear({...year,startDate:e.target.value})}/></FormField><FormField label="إلى"><Input required type="date" value={year.endDate} onChange={e=>setYear({...year,endDate:e.target.value})}/></FormField><Button type="submit">إنشاء</Button></form></Card>:null}{operate?<Card title="فترة محاسبية"><form onSubmit={addPeriod}><FormField label="السنة"><Select required value={period.fiscalYearId} onChange={e=>setPeriod({...period,fiscalYearId:e.target.value})}><option value="">اختر</option>{data.fiscalYears.map(x=><option key={x.id} value={x.id}>{x.startDate} — {x.endDate}</option>)}</Select></FormField><FormField label="من"><Input required type="date" value={period.startDate} onChange={e=>setPeriod({...period,startDate:e.target.value})}/></FormField><FormField label="إلى"><Input required type="date" value={period.endDate} onChange={e=>setPeriod({...period,endDate:e.target.value})}/></FormField><Button type="submit">إنشاء</Button></form></Card>:null}</div>
 <DataGrid columns={['الفترة','من','إلى','الحالة']}>{data.periods.map(x=><tr key={x.id}><td>{x.fiscalYearId}</td><td>{x.startDate}</td><td>{x.endDate}</td><td>{x.status}</td></tr>)}</DataGrid></>;
}

function Billing({data}:{data:AccountingOverview}){return <DataGrid columns={['الفاتورة','النوع','الطرف','العملة','الإجمالي','المتبقي','الحالة']}>{data.invoices.map(x=><tr key={x.id}><td>{x.number}</td><td>{x.type}</td><td>{x.partyId}</td><td>{x.currency}</td><td>{x.baseTotal}</td><td>{x.outstanding}</td><td>{x.status}</td></tr>)}</DataGrid>}

function Treasury({data,operate,done}:{data:AccountingOverview;operate:boolean;done:(message:string)=>Promise<void>}){
 const[form,setForm]=useState({code:'',name:'',type:'CASH' as 'CASH'|'BANK',currency:'EGP',glAccountId:''});
 async function submit(e:FormEvent){e.preventDefault();await accountingApi.createTreasury(form);setForm({code:'',name:'',type:'CASH',currency:'EGP',glAccountId:''});await done('تم إنشاء الخزينة/الحساب البنكي.');}
 return <><Card title="الخزائن والبنوك">{operate?<form className="ui-filter-grid" onSubmit={submit}><FormField label="الكود"><Input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></FormField><FormField label="الاسم"><Input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></FormField><FormField label="النوع"><Select value={form.type} onChange={e=>setForm({...form,type:e.target.value as 'CASH'|'BANK'})}><option value="CASH">خزينة</option><option value="BANK">بنك</option></Select></FormField><FormField label="العملة"><Input required value={form.currency} onChange={e=>setForm({...form,currency:e.target.value.toUpperCase()})}/></FormField><FormField label="حساب الأستاذ"><Select required value={form.glAccountId} onChange={e=>setForm({...form,glAccountId:e.target.value})}><option value="">اختر</option>{data.accounts.filter(x=>x.active&&x.postable).map(x=><option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}</Select></FormField><Button type="submit">إنشاء</Button></form>:null}</Card>
 <DataGrid columns={['الكود','الاسم','النوع','العملة','الحالة']}>{data.treasuries.map(x=><tr key={x.id}><td>{x.code}</td><td>{x.name}</td><td>{x.type==='BANK'?'بنك':'خزينة'}</td><td>{x.currency}</td><td>{x.active?'نشط':'غير نشط'}</td></tr>)}</DataGrid>
 <Card title="الحركة"><DataGrid columns={['المستند','النوع','التاريخ','العملة','المبلغ','الحالة']}>{data.vouchers.map(x=><tr key={x.id}><td>{x.number}</td><td>{x.kind}</td><td>{x.postingDate}</td><td>{x.currency}</td><td>{x.amount}</td><td>{x.status}</td></tr>)}</DataGrid></Card></>;
}

function Reports({data}:{data:AccountingOverview}){return <div className="ui-grid-md"><Card title="ميزان المراجعة"><ReportTable rows={data.reports.trialBalance.rows}/></Card><Card title="قائمة الدخل"><ReportTable rows={data.reports.incomeStatement.rows}/></Card><Card title="المركز المالي"><ReportTable rows={data.reports.balanceSheet.rows}/></Card><Card title="إجمالي الخزائن"><DataGrid columns={['العملة','الإجمالي']}>{data.reports.treasury.totals.map(x=><tr key={x.currency}><td>{x.currency}</td><td>{x.amount}</td></tr>)}</DataGrid></Card></div>}
function ReportTable({rows}:{rows:{accountId?:string;accountClass?:string;currency:string;amount:string}[]}){return <DataGrid columns={['البند','العملة','القيمة']}>{rows.map((x,i)=><tr key={(x.accountId??x.accountClass??'row')+i}><td>{x.accountId??x.accountClass??'—'}</td><td>{x.currency}</td><td>{x.amount}</td></tr>)}</DataGrid>}
