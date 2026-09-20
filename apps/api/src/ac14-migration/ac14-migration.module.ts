import { Module } from '@nestjs/common';
import { PlatformCoreModule } from '@elhafez/platform-core';
import { Ac14PreflightService } from './preflight.service.js';

/**
 * AC-14A coordinator skeleton.
 *
 * Depends only on `@elhafez/platform-core`'s public API. It is
 * intentionally NOT imported by `AppModule` yet — AC-14A ships the
 * control-plane foundation only. A later AC-14 batch will register this
 * (or its successor) in the composition root once owner-scoped historical
 * import orchestration exists.
 */
@Module({
  imports: [PlatformCoreModule],
  providers: [Ac14PreflightService],
  exports: [Ac14PreflightService],
})
export class Ac14MigrationModule {}
