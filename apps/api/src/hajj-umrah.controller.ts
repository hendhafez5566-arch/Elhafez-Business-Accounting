import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { executionContext, type ExecutionContext } from '@elhafez/contracts';
import {
  PlatformCoreApplicationService,
  PlatformError,
} from '@elhafez/platform-core';
import {
  HajjUmrahSeasonsApplicationService,
  SEASON_PERMISSIONS,
  type SeasonInput,
} from '@elhafez/hajj-umrah-seasons';
import {
  HajjUmrahProgramsApplicationService,
  PROGRAM_PERMISSIONS,
  type ProgramInput,
} from '@elhafez/hajj-umrah-programs';

type RequestHeaders = {
  authorization: string | undefined;
  companyId: string | undefined;
  branchId: string | undefined;
};

@Controller('hajj-umrah')
export class HajjUmrahController {
  static readonly runtimeDependencies = [
    HajjUmrahSeasonsApplicationService,
    HajjUmrahProgramsApplicationService,
    PlatformCoreApplicationService,
  ] as const;

  constructor(
    private readonly seasons: HajjUmrahSeasonsApplicationService,
    private readonly programs: HajjUmrahProgramsApplicationService,
    private readonly platform: PlatformCoreApplicationService,
  ) {}

  @Get('capabilities')
  async capabilities(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
  ) {
    const context = await this.context({ authorization, companyId, branchId });
    await this.platform.requireBranchAccess(context.actorId, context.companyId, context.branchId);
    const permissions = {
      seasonManage: SEASON_PERMISSIONS.manage,
      seasonLifecycle: SEASON_PERMISSIONS.lifecycle,
      programCreate: PROGRAM_PERMISSIONS.create,
      programEdit: PROGRAM_PERMISSIONS.edit,
      programAmend: PROGRAM_PERMISSIONS.amend,
      programAvailability: PROGRAM_PERMISSIONS.availability,
      programLifecycle: PROGRAM_PERMISSIONS.lifecycle,
      programCancel: PROGRAM_PERMISSIONS.cancel,
      programReopen: PROGRAM_PERMISSIONS.reopen,
    };
    return Object.fromEntries(
      await Promise.all(
        Object.entries(permissions).map(async ([key, permission]) => [
          key,
          await this.allowed(context, permission),
        ]),
      ),
    );
  }

  @Get('seasons')
  async listSeasons(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
  ) {
    return this.seasons.list(await this.context({ authorization, companyId, branchId }));
  }

  @Get('seasons/:id')
  async getSeason(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.seasons.get(await this.context({ authorization, companyId, branchId }), id);
  }

  @Post('seasons')
  async createSeason(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Body() input: SeasonInput,
  ) {
    return this.seasons.create(await this.context({ authorization, companyId, branchId }), input);
  }

  @Patch('seasons/:id')
  async updateSeason(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
    @Body() input: SeasonInput,
  ) {
    return this.seasons.update(await this.context({ authorization, companyId, branchId }), id, input);
  }

  @Post('seasons/:id/close')
  async closeSeason(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.seasons.close(await this.context({ authorization, companyId, branchId }), id);
  }

  @Post('seasons/:id/cancel')
  async cancelSeason(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.seasons.cancel(
      await this.context({ authorization, companyId, branchId }),
      id,
      body.reason,
    );
  }

  @Get('programs')
  async listPrograms(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
  ) {
    return this.programs.list(await this.context({ authorization, companyId, branchId }));
  }

  @Get('programs/:id')
  async getProgram(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.programs.get(await this.context({ authorization, companyId, branchId }), id);
  }

  @Post('programs')
  async createProgram(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Body() input: ProgramInput,
  ) {
    return this.programs.create(await this.context({ authorization, companyId, branchId }), input);
  }

  @Patch('programs/:id/preparing')
  async editPreparingProgram(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
    @Body() input: ProgramInput,
  ) {
    return this.programs.editPreparing(
      await this.context({ authorization, companyId, branchId }),
      id,
      input,
    );
  }

  @Post('programs/:id/amend')
  async amendProgram(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
    @Body() body: { input: ProgramInput; reason: string },
  ) {
    return this.programs.amend(
      await this.context({ authorization, companyId, branchId }),
      id,
      body.input,
      body.reason,
    );
  }

  @Get('programs/:id/versions')
  async programVersions(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.programs.versions(
      await this.context({ authorization, companyId, branchId }),
      id,
    );
  }

  @Post('programs/:id/open')
  async openProgram(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.programs.openForBooking(
      await this.context({ authorization, companyId, branchId }),
      id,
    );
  }

  @Patch('programs/:id/booking-availability')
  async bookingAvailability(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
    @Body() body: { open: boolean },
  ) {
    return this.programs.setBookingAvailability(
      await this.context({ authorization, companyId, branchId }),
      id,
      body.open,
    );
  }

  @Post('programs/:id/departure')
  async departure(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.programs.recordDeparture(
      await this.context({ authorization, companyId, branchId }),
      id,
    );
  }

  @Post('programs/:id/return')
  async returned(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
  ) {
    return this.programs.recordReturn(
      await this.context({ authorization, companyId, branchId }),
      id,
    );
  }

  @Post('programs/:id/cancel')
  async cancelProgram(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.programs.cancel(
      await this.context({ authorization, companyId, branchId }),
      id,
      body.reason,
    );
  }

  @Post('programs/:id/reopen')
  async reopenProgram(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-company-id') companyId: string | undefined,
    @Headers('x-branch-id') branchId: string | undefined,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.programs.reopen(
      await this.context({ authorization, companyId, branchId }),
      id,
      body.reason,
    );
  }

  private async allowed(context: ExecutionContext, permission: string) {
    try {
      await this.platform.authorize(context.actorId, permission);
      return true;
    } catch (error) {
      if (error instanceof PlatformError && error.code === 'FORBIDDEN') return false;
      throw error;
    }
  }

  private async context(headers: RequestHeaders): Promise<ExecutionContext> {
    if (
      !headers.authorization?.startsWith('Bearer ') ||
      !headers.companyId ||
      !headers.branchId
    ) {
      throw new UnauthorizedException('authenticated company and branch context required');
    }
    const user = await this.platform.currentUser(headers.authorization.slice(7));
    return executionContext(headers.companyId, headers.branchId, user.id);
  }
}
