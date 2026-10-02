import { useEffect, useState, type ComponentType } from 'react';
import { accountingApi, type AccountingCapabilities, type AccountingOverview } from './accounting-client.js';
import type { AccountingPresentationProps } from './pages/accounting/accounting-pages.js';
import { EmptyState, ErrorState, LoadingState } from './ui.js';

const emptyOverview:AccountingOverview={fiscalYears:[],periods:[],accounts:[],journals:[],invoices:[],treasuries:[],vouchers:[],taxPolicies:[],approvalPolicies:[],approvalRequests:[],controlIssues:[],reports:{trialBalance:{rows:[]},incomeStatement:{rows:[]},balanceSheet:{rows:[]},treasury:{totals:[]},tax:{totals:[],facts:[]}}};

export function AccountingLegacyRoutePage({presentation:Presentation}:{readonly presentation:ComponentType<AccountingPresentationProps>}){
 const[data,setData]=useState<AccountingOverview>(emptyOverview),[capabilities,setCapabilities]=useState<AccountingCapabilities>({read:false,operate:false}),[notice]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 async function reload(){setLoading(true);setError('');try{const[nextCapabilities,nextData]=await Promise.all([accountingApi.capabilities(),accountingApi.overview()]);setCapabilities(nextCapabilities);setData(nextData);}catch(value){setError(value instanceof Error?value.message:'تعذر تحميل المحاسبة.');}finally{setLoading(false);}}
 useEffect(()=>{void reload();},[]);
 if(loading)return <LoadingState/>;if(error)return <ErrorState message={error}/>;if(!capabilities.read)return <EmptyState title="لا توجد صلاحية للمحاسبة"/>;
 return <Presentation data={data} capabilities={capabilities} notice={notice} reload={reload}/>;
}
