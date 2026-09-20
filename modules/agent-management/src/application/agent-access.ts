import type { ExecutionContext } from '@elhafez/contracts';
export interface AgentAccess{requireBranch(context:ExecutionContext):Promise<void>;requirePermission(context:ExecutionContext,permission:string):Promise<void>;audit(context:ExecutionContext,action:string,resource:string,entityId:string|null,metadata?:Record<string,unknown>):Promise<void>;}
export const AGENT_ACCESS=Symbol('AGENT_ACCESS');
