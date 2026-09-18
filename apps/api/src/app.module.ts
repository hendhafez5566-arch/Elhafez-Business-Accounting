import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '@elhafez/platform-core';
import { PeriodControlModule } from '@elhafez/period-control';
import { GeneralLedgerModule } from '@elhafez/general-ledger';
import { FinancialControlsModule } from '@elhafez/financial-controls';
import { TaxModule } from '@elhafez/tax';
import { BillingSubledgersModule } from '@elhafez/billing-subledgers';

/** Composition root only. Business modules are registered here through public module APIs. */
@Module({ imports: [PlatformCoreModule, PeriodControlModule, GeneralLedgerModule, FinancialControlsModule, TaxModule, BillingSubledgersModule] })
export class AppModule {}
