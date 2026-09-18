import { Module } from '@nestjs/common';

/** Platform composition boundary. HTTP adapters may depend only on its public service. */
@Module({})
export class PlatformCoreModule {}
