import { Module } from '@nestjs/common';import {PrismaClient} from '@prisma/client';
import { CsvParser,DataExchangeApplicationService,XlsxParser } from './application/data-exchange.application-service.js';import {PrismaDataExchangeRepository} from './infrastructure/prisma-data-exchange.repository.js';
const REPOSITORY=Symbol('DATA_EXCHANGE_REPOSITORY');
@Module({providers:[PrismaClient,{provide:REPOSITORY,useFactory:(p:PrismaClient)=>new PrismaDataExchangeRepository(p),inject:[PrismaClient]},{provide:DataExchangeApplicationService,useFactory:(r:PrismaDataExchangeRepository)=>new DataExchangeApplicationService(r,[new CsvParser(),new XlsxParser()]),inject:[REPOSITORY]}],exports:[DataExchangeApplicationService]}) export class DataExchangeModule{}
