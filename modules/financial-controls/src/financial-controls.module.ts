import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { FinancialControlsApplicationService, DenyByDefaultAuthorization, TRUSTED_AUTHORIZATION_PORT, type TrustedAuthorizationPort } from './application/financial-controls.application-service.js';
import { FINANCIAL_CONTROLS_REPOSITORY, type FinancialControlsRepository } from './application/financial-controls.repository.js';
import { PrismaFinancialControlsRepository } from './infrastructure/prisma-financial-controls.repository.js';

@Module({ providers: [PrismaClient, { provide: TRUSTED_AUTHORIZATION_PORT, useClass: DenyByDefaultAuthorization }, { provide: FINANCIAL_CONTROLS_REPOSITORY, useFactory: (db: PrismaClient) => new PrismaFinancialControlsRepository(db), inject: [PrismaClient] }, { provide: FinancialControlsApplicationService, useFactory: (repository: FinancialControlsRepository, authorization: TrustedAuthorizationPort) => new FinancialControlsApplicationService(repository, authorization), inject: [FINANCIAL_CONTROLS_REPOSITORY, TRUSTED_AUTHORIZATION_PORT] }], exports: [FinancialControlsApplicationService] })
export class FinancialControlsModule {}
