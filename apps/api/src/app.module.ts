import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '@elhafez/platform-core';
import { PeriodControlModule } from '@elhafez/period-control';
import { GeneralLedgerModule } from '@elhafez/general-ledger';

/** Composition root only. Business modules are registered here through public module APIs. */
@Module({ imports: [PlatformCoreModule, PeriodControlModule, GeneralLedgerModule] })
export class AppModule {}
