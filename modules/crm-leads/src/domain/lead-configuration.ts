import type{BranchId,CompanyId}from'@elhafez/contracts';
export interface LeadSourceConfig{readonly code:string;readonly label:string;readonly active:boolean}
export interface CampaignConfig{readonly id:string;readonly name:string;readonly sourceCode:string|null;readonly active:boolean}
export interface PipelineStageConfig{readonly key:string;readonly label:string;readonly baseStatus:'NEW'|'CONTACTED'|'QUALIFIED'|'QUOTED'|'WON'|'LOST';readonly order:number;readonly active:boolean}
export interface LeadAssignmentRule{readonly id:string;readonly sourceCode:string|null;readonly requestedService:string|null;readonly userIds:readonly string[];readonly nextIndex:number;readonly active:boolean}
export interface LeadScoringRule{readonly id:string;readonly field:'SOURCE'|'SERVICE'|'EXPECTED_VALUE_MIN';readonly value:string;readonly points:number;readonly active:boolean}
export interface LeadConfiguration{readonly companyId:CompanyId;readonly branchId:BranchId;readonly sources:readonly LeadSourceConfig[];readonly campaigns:readonly CampaignConfig[];readonly pipelineStages:readonly PipelineStageConfig[];readonly assignmentRules:readonly LeadAssignmentRule[];readonly scoringRules:readonly LeadScoringRule[];readonly contactSlaMinutes:number;readonly updatedAt:string}
