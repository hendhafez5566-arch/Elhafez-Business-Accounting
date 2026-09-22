import {
  Body, Controller, Get, Headers, Param, Patch, Post, Query, UnauthorizedException,
} from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import { PlatformCoreApplicationService, PlatformError } from '@elhafez/platform-core';
import {
  BOOKING_PERMISSIONS,
  HajjUmrahBookingsApplicationService,
  type CancelOperationalBookingInput,
  type ConfirmOperationalBookingInput,
  type CreateBookingInput,
} from '@elhafez/hajj-umrah-bookings';
import {
  HajjUmrahRoomingApplicationService,
  ROOMING_PERMISSIONS,
  type AssignRoomInput,
  type ReassignRoomInput,
} from '@elhafez/hajj-umrah-rooming';
import {
  HajjUmrahVisaOperationsApplicationService,
  VISA_PERMISSIONS,
  type CreateVisaCaseInput,
  type IssueVisaInput,
} from '@elhafez/hajj-umrah-visa-operations';
import {
  HajjUmrahTicketingApplicationService,
  TICKET_PERMISSIONS,
  type ReserveTicketInput,
  type TicketIssueInput,
} from '@elhafez/hajj-umrah-ticketing';
import {
  HajjUmrahTransportOperationsApplicationService,
  TRANSPORT_PERMISSIONS,
  type CreateTransportRunInput,
} from '@elhafez/hajj-umrah-transport-operations';
import {
  HajjUmrahTripOperationsApplicationService,
  TRIP_PERMISSIONS,
  type CreateIncidentInput,
  type CreateTaskInput,
  type RecordServiceExecutionInput,
} from '@elhafez/hajj-umrah-trip-operations';

type RequestHeaders={authorization:string|undefined;companyId:string|undefined;branchId:string|undefined};

@Controller('hajj-umrah/operations')
export class HajjUmrahOperationsController {
  static readonly runtimeDependencies=[
    HajjUmrahBookingsApplicationService,HajjUmrahRoomingApplicationService,HajjUmrahVisaOperationsApplicationService,
    HajjUmrahTicketingApplicationService,HajjUmrahTransportOperationsApplicationService,HajjUmrahTripOperationsApplicationService,
    PlatformCoreApplicationService,
  ] as const;
  constructor(
    private readonly bookings:HajjUmrahBookingsApplicationService,
    private readonly rooming:HajjUmrahRoomingApplicationService,
    private readonly visas:HajjUmrahVisaOperationsApplicationService,
    private readonly tickets:HajjUmrahTicketingApplicationService,
    private readonly transport:HajjUmrahTransportOperationsApplicationService,
    private readonly trip:HajjUmrahTripOperationsApplicationService,
    private readonly platform:PlatformCoreApplicationService,
  ){}

  @Get('capabilities')
  async capabilities(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined){
    const c=await this.context({authorization,companyId,branchId});await this.platform.requireBranchAccess(c.actorId,c.companyId,c.branchId);
    const permissions={
      bookingView:BOOKING_PERMISSIONS.view,bookingManage:BOOKING_PERMISSIONS.manage,bookingConfirm:BOOKING_PERMISSIONS.confirm,bookingLifecycle:BOOKING_PERMISSIONS.lifecycle,bookingCancel:BOOKING_PERMISSIONS.cancel,
      roomingView:ROOMING_PERMISSIONS.view,roomingManage:ROOMING_PERMISSIONS.manage,
      visaView:VISA_PERMISSIONS.view,visaManage:VISA_PERMISSIONS.manage,visaIssue:VISA_PERMISSIONS.issue,
      ticketView:TICKET_PERMISSIONS.view,ticketManage:TICKET_PERMISSIONS.manage,ticketIssue:TICKET_PERMISSIONS.issue,
      transportView:TRANSPORT_PERMISSIONS.view,transportManage:TRANSPORT_PERMISSIONS.manage,transportDispatch:TRANSPORT_PERMISSIONS.dispatch,
      tripView:TRIP_PERMISSIONS.view,tripManage:TRIP_PERMISSIONS.manage,
    };
    return Object.fromEntries(await Promise.all(Object.entries(permissions).map(async([key,p])=>[key,await this.allowed(c,p)])));
  }

  @Get('bookings')
  async listBookings(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined){
    return this.bookings.list(await this.context({authorization,companyId,branchId}));
  }

  @Post('bookings')
  async createBooking(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:CreateBookingInput){
    return this.bookings.create(await this.context({authorization,companyId,branchId}),input);
  }
  @Get('bookings/:id')
  async getBooking(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){
    return this.bookings.get(await this.context({authorization,companyId,branchId}),id);
  }
  @Get('bookings/:id/history')
  async bookingHistory(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){
    return this.bookings.historyFor(await this.context({authorization,companyId,branchId}),id);
  }
  @Post('bookings/:id/confirm')
  async confirmBooking(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() input:ConfirmOperationalBookingInput){
    return this.bookings.confirm(await this.context({authorization,companyId,branchId}),id,input);
  }
  @Post('bookings/:id/cancel')
  async cancelBooking(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() input:CancelOperationalBookingInput){
    return this.bookings.cancel(await this.context({authorization,companyId,branchId}),id,input);
  }
  @Post('bookings/:id/ready')
  async readyBooking(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){
    return this.bookings.markReady(await this.context({authorization,companyId,branchId}),id);
  }
  @Post('bookings/:id/travel')
  async travelBooking(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){
    return this.bookings.startTravel(await this.context({authorization,companyId,branchId}),id);
  }
  @Post('bookings/:id/complete')
  async completeBooking(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){
    return this.bookings.complete(await this.context({authorization,companyId,branchId}),id);
  }

  @Get('rooming')
  async listRooming(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Query('programId') programId?:string){
    return this.rooming.list(await this.context({authorization,companyId,branchId}),programId);
  }
  @Post('rooming')
  async assignRoom(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:AssignRoomInput){
    return this.rooming.assign(await this.context({authorization,companyId,branchId}),input);
  }
  @Patch('rooming/:id')
  async reassignRoom(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() input:ReassignRoomInput){
    return this.rooming.reassign(await this.context({authorization,companyId,branchId}),id,input);
  }
  @Get('rooming/:id/history')
  async roomingHistory(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){
    return this.rooming.historyFor(await this.context({authorization,companyId,branchId}),id);
  }
  @Post('rooming/:id/unassign')
  async unassignRoom(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){
    return this.rooming.unassign(await this.context({authorization,companyId,branchId}),id);
  }
  @Post('rooming/swap')
  async swapRooms(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() body:{leftId:string;rightId:string}){
    return this.rooming.swap(await this.context({authorization,companyId,branchId}),body.leftId,body.rightId);
  }

  @Get('visas')
  async listVisas(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Query('programId') programId?:string){return this.visas.list(await this.context({authorization,companyId,branchId}),programId)}
  @Post('visas')
  async createVisa(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:CreateVisaCaseInput){return this.visas.create(await this.context({authorization,companyId,branchId}),input)}
  @Get('visas/:id/history')
  async visaHistory(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.visas.historyFor(await this.context({authorization,companyId,branchId}),id)}
  @Post('visas/:id/submit')
  async submitVisa(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() body:{applicationReference:string}){return this.visas.submit(await this.context({authorization,companyId,branchId}),id,body.applicationReference)}
  @Post('visas/:id/issue')
  async issueVisa(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() input:IssueVisaInput){return this.visas.issue(await this.context({authorization,companyId,branchId}),id,input)}
  @Post('visas/:id/reject')
  async rejectVisa(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() body:{reason:string}){return this.visas.reject(await this.context({authorization,companyId,branchId}),id,body.reason)}
  @Post('visas/:id/cancel')
  async cancelVisa(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() body:{reason:string}){return this.visas.cancel(await this.context({authorization,companyId,branchId}),id,body.reason)}

  @Get('tickets')
  async listTickets(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Query('programId') programId?:string){return this.tickets.list(await this.context({authorization,companyId,branchId}),programId)}
  @Post('tickets')
  async reserveTicket(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:ReserveTicketInput){return this.tickets.reserve(await this.context({authorization,companyId,branchId}),input)}
  @Get('tickets/:id/history')
  async ticketHistory(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.tickets.historyFor(await this.context({authorization,companyId,branchId}),id)}
  @Post('tickets/:id/issue')
  async issueTicket(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() input:TicketIssueInput){return this.tickets.issue(await this.context({authorization,companyId,branchId}),id,input)}
  @Post('tickets/:id/reissue')
  async reissueTicket(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() input:TicketIssueInput){return this.tickets.reissue(await this.context({authorization,companyId,branchId}),id,input)}
  @Post('tickets/:id/void')
  async voidTicket(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() body:{reason:string}){return this.tickets.voidTicket(await this.context({authorization,companyId,branchId}),id,body.reason)}
  @Post('tickets/:id/cancel')
  async cancelTicket(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() body:{reason:string}){return this.tickets.cancel(await this.context({authorization,companyId,branchId}),id,body.reason)}

  @Get('transport/runs')
  async listRuns(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Query('programId') programId?:string){return this.transport.listRuns(await this.context({authorization,companyId,branchId}),programId)}
  @Post('transport/runs')
  async createRun(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:CreateTransportRunInput){return this.transport.createRun(await this.context({authorization,companyId,branchId}),input)}
  @Get('transport/runs/:id/manifest')
  async manifest(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.transport.manifest(await this.context({authorization,companyId,branchId}),id)}
  @Post('transport/runs/:id/manifest')
  async assignRun(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() body:{bookingId:string;travelerId:string}){return this.transport.assignTraveler(await this.context({authorization,companyId,branchId}),id,body.bookingId,body.travelerId)}
  @Post('transport/runs/:id/manifest/:assignmentId/remove')
  async removeRunTraveler(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Param('assignmentId') assignmentId:string){return this.transport.removeTraveler(await this.context({authorization,companyId,branchId}),assignmentId,id)}
  @Get('transport/runs/:id/history')
  async transportHistory(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.transport.historyFor(await this.context({authorization,companyId,branchId}),'RUN',id)}
  @Post('transport/runs/:id/dispatch')
  async dispatch(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.transport.dispatch(await this.context({authorization,companyId,branchId}),id)}
  @Post('transport/runs/:id/cancel')
  async cancelRun(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() body:{reason:string}){return this.transport.cancel(await this.context({authorization,companyId,branchId}),id,body.reason)}
  @Post('transport/runs/:id/complete')
  async completeRun(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.transport.complete(await this.context({authorization,companyId,branchId}),id)}

  @Get('trip/tasks')
  async listTasks(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Query('programId') programId?:string){return this.trip.listTasks(await this.context({authorization,companyId,branchId}),programId)}
  @Post('trip/tasks')
  async createTask(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:CreateTaskInput){return this.trip.createTask(await this.context({authorization,companyId,branchId}),input)}
  @Get('trip/tasks/due')
  async dueTasks(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Query('date') date:string){return this.trip.dueTasks(await this.context({authorization,companyId,branchId}),date)}
  @Get('trip/tasks/overdue')
  async overdueTasks(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Query('at') at:string){return this.trip.overdueTasks(await this.context({authorization,companyId,branchId}),at)}
  @Post('trip/tasks/:id/complete')
  async completeTask(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.trip.completeTask(await this.context({authorization,companyId,branchId}),id)}
  @Post('trip/tasks/:id/cancel')
  async cancelTask(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() body:{reason:string}){return this.trip.cancelTask(await this.context({authorization,companyId,branchId}),id,body.reason)}

  @Get('trip/incidents')
  async listIncidents(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Query('programId') programId?:string){return this.trip.listIncidents(await this.context({authorization,companyId,branchId}),programId)}
  @Post('trip/incidents')
  async createIncident(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:CreateIncidentInput){return this.trip.createIncident(await this.context({authorization,companyId,branchId}),input)}
  @Get('trip/incidents/:id/history')
  async incidentHistory(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string){return this.trip.historyFor(await this.context({authorization,companyId,branchId}),'INCIDENT',id)}
  @Post('trip/incidents/:id/resolve')
  async resolveIncident(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() body:{resolution:string}){return this.trip.resolveIncident(await this.context({authorization,companyId,branchId}),id,body.resolution)}
  @Post('trip/incidents/:id/cancel')
  async cancelIncident(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Param('id') id:string,@Body() body:{reason:string}){return this.trip.cancelIncident(await this.context({authorization,companyId,branchId}),id,body.reason)}

  @Get('trip/services')
  async listServices(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Query('programId') programId?:string){return this.trip.listServices(await this.context({authorization,companyId,branchId}),programId)}
  @Post('trip/services')
  async recordService(@Headers('authorization') authorization:string|undefined,@Headers('x-company-id') companyId:string|undefined,@Headers('x-branch-id') branchId:string|undefined,@Body() input:RecordServiceExecutionInput){return this.trip.recordServiceExecution(await this.context({authorization,companyId,branchId}),input)}

  private async allowed(c:ExecutionContext,p:string){try{await this.platform.authorize(c.actorId,p);return true}catch(error){if(error instanceof PlatformError&&error.code==='FORBIDDEN')return false;throw error}}
  private async context(h:RequestHeaders):Promise<ExecutionContext>{if(!h.authorization?.startsWith('Bearer ')||!h.companyId||!h.branchId)throw new UnauthorizedException('authenticated company and branch context required');const user=await this.platform.currentUser(h.authorization.slice(7));return executionContext(h.companyId,h.branchId,user.id)}
}
