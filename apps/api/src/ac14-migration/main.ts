import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { Ac14MigrationCoordinator } from './coordinator.service.js';
import { runAc14Cli } from './cli.js';
const app=await NestFactory.createApplicationContext(AppModule,{logger:false});
try { const result=await runAc14Cli(app.get(Ac14MigrationCoordinator),process.argv.slice(2)); process.stdout.write(`${JSON.stringify(result,null,2)}\n`); } finally { await app.close(); }
