import { readTenantSession } from './tenant-session.js';
import type { CrmApiContext } from './crm-core-client.js';
import type { DraftScope } from './followup-draft-store.js';
export function followupLocalContext():{scope:DraftScope;api:CrmApiContext} {
 const session=readTenantSession();
 if(!session||session.mustChangePassword||!session.subscription.allowed)throw new Error('يلزم تسجيل دخول صالح وحساب مسموح له بالتشغيل.');
 if(!Number.isFinite(Date.parse(session.expiresAt))||!session.branches.some(branch=>branch.id===session.branchId&&branch.companyId===session.companyId&&branch.active))throw new Error('جلسة الفرع غير صالحة.');
 return {scope:{companyId:session.companyId,branchId:session.branchId,userId:session.userId},api:{token:session.token,companyId:session.companyId,branchId:session.branchId}};
}
