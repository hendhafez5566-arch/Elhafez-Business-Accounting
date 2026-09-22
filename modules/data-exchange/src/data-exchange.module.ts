import { Module } from '@nestjs/common';
import { DataExchangeApplicationService,InMemoryDataExchangeRepository } from './application/data-exchange.application-service.js';
@Module({providers:[InMemoryDataExchangeRepository,{provide:DataExchangeApplicationService,useFactory:(r:InMemoryDataExchangeRepository)=>new DataExchangeApplicationService(r),inject:[InMemoryDataExchangeRepository]}],exports:[DataExchangeApplicationService]}) export class DataExchangeModule{}
