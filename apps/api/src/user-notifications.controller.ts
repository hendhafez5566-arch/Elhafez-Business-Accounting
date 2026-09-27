import{Controller,Get,Headers,Param,Post,UnauthorizedException}from'@nestjs/common';
import type{PlatformCoreApplicationService}from'@elhafez/platform-core';

@Controller('notifications')
export class UserNotificationsController{
 constructor(private readonly platform:PlatformCoreApplicationService){}
 @Get()async list(@Headers('authorization')authorization?:string,@Headers('x-company-id')companyId?:string,@Headers('x-branch-id')branchId?:string){
  const actorId=await this.actor(authorization,companyId,branchId);
  const items=await this.platform.listNotifications(actorId,companyId);
  return{items,unreadCount:items.filter(item=>!item.readAt).length};
 }
 @Post('read-all')async readAll(@Headers('authorization')authorization?:string,@Headers('x-company-id')companyId?:string,@Headers('x-branch-id')branchId?:string){
  const actorId=await this.actor(authorization,companyId,branchId);
  return{updated:await this.platform.markAllNotificationsRead(actorId,companyId)};
 }
 @Post(':id/read')async read(@Headers('authorization')authorization:string|undefined,@Headers('x-company-id')companyId:string|undefined,@Headers('x-branch-id')branchId:string|undefined,@Param('id')id:string){
  const actorId=await this.actor(authorization,companyId,branchId);
  return this.platform.markNotificationRead(actorId,id,companyId);
 }
 private async actor(authorization?:string,companyId?:string,branchId?:string){
  if(!authorization?.startsWith('Bearer ')||!companyId||!branchId)throw new UnauthorizedException('authenticated company and branch context required');
  const user=await this.platform.currentUser(authorization.slice(7));
  await this.platform.requireBranchAccess(user.id,companyId,branchId);
  return user.id;
 }
}
