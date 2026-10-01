import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '@elhafez/platform-core';
import { CurrencyFxModule } from '../currency-fx.module.js';
import { CurrencyFxController } from './currency-fx.controller.js';

@Module({
  imports: [PlatformCoreModule, CurrencyFxModule],
  controllers: [CurrencyFxController],
})
export class CurrencyFxHttpModule {}
