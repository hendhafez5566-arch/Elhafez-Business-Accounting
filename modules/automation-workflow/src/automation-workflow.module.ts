import{Module}from'@nestjs/common';
import{PrismaClient}from'@prisma/client';
import{PlatformCoreApplicationService,PlatformCoreModule}from'@elhafez/platform-core';
import{AUTOMATION_WORKFLOW_ACCESS,WORKFLOW_ACTION_DISPATCHER,WORKFLOW_EXECUTION_EVIDENCE,type AutomationWorkflowAccess,type WorkflowActionDispatcher,type WorkflowExecutionEvidence}from'./application/automation-workflow.ports.js';
import{AUTOMATION_WORKFLOW_REPOSITORY,type AutomationWorkflowRepository}from'./application/automation-workflow.repository.js';
import{AutomationWorkflowApplicationService}from'./application/automation-workflow.application-service.js';
import{AutomationWorkflowController}from'./infrastructure/automation-workflow.controller.js';
import{AutomationWorkflowWorker}from'./infrastructure/automation-workflow.worker.js';
import{PlatformAutomationWorkflowAccess}from'./infrastructure/platform-automation-workflow.access.js';
import{PlatformWorkflowActionDispatcher}from'./infrastructure/platform-workflow-action.dispatcher.js';
import{PrismaAutomationWorkflowRepository}from'./infrastructure/prisma-automation-workflow.repository.js';

@Module({imports:[PlatformCoreModule],controllers:[AutomationWorkflowController],providers:[
 PrismaClient,
 {provide:PrismaAutomationWorkflowRepository,useFactory:(db:PrismaClient)=>new PrismaAutomationWorkflowRepository(db),inject:[PrismaClient]},
 {provide:AUTOMATION_WORKFLOW_REPOSITORY,useExisting:PrismaAutomationWorkflowRepository},
 {provide:WORKFLOW_EXECUTION_EVIDENCE,useExisting:PrismaAutomationWorkflowRepository},
 {provide:AUTOMATION_WORKFLOW_ACCESS,useFactory:(platform:PlatformCoreApplicationService)=>new PlatformAutomationWorkflowAccess(platform),inject:[PlatformCoreApplicationService]},
 {provide:WORKFLOW_ACTION_DISPATCHER,useFactory:(platform:PlatformCoreApplicationService)=>new PlatformWorkflowActionDispatcher(platform),inject:[PlatformCoreApplicationService]},
 {provide:AutomationWorkflowApplicationService,useFactory:(repo:AutomationWorkflowRepository,access:AutomationWorkflowAccess,dispatcher:WorkflowActionDispatcher,evidence:WorkflowExecutionEvidence)=>new AutomationWorkflowApplicationService(repo,access,dispatcher,evidence),inject:[AUTOMATION_WORKFLOW_REPOSITORY,AUTOMATION_WORKFLOW_ACCESS,WORKFLOW_ACTION_DISPATCHER,WORKFLOW_EXECUTION_EVIDENCE]},
 AutomationWorkflowWorker
],exports:[AutomationWorkflowApplicationService]})
export class AutomationWorkflowModule{}
