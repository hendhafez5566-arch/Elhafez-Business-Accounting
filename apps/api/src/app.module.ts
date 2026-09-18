import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '@elhafez/platform-core';

/** Composition root only. Business modules are registered here through public module APIs. */
@Module({ imports: [PlatformCoreModule] })
export class AppModule {}
