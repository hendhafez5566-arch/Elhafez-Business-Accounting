import{Inject,Injectable,Logger,OnModuleDestroy,OnModuleInit}from'@nestjs/common';
import{AutomationWorkflowApplicationService}from'../application/automation-workflow.application-service.js';
@Injectable()
export class AutomationWorkflowWorker implements OnModuleInit,OnModuleDestroy{
 private readonly logger=new Logger(AutomationWorkflowWorker.name);private timer:ReturnType<typeof setInterval>|undefined;
 constructor(@Inject(AutomationWorkflowApplicationService)private readonly service:AutomationWorkflowApplicationService){}
 onModuleInit(){this.timer=setInterval(()=>{void this.service.executeDue(50).catch(error=>this.logger.error(error instanceof Error?error.message:'automation workflow tick failed'));},30000);this.timer.unref();}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
}
