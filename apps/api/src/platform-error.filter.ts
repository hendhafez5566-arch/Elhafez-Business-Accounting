import { ContractValidationError } from '@elhafez/contracts';
import { Catch, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { PlatformError } from '@elhafez/platform-core';

type HttpResponse = { status(code:number): HttpResponse; json(body:unknown): void };

const statusFor=(code:string)=>code==='VALIDATION_ERROR'?HttpStatus.BAD_REQUEST
 :code==='UNAUTHENTICATED'||code==='INVALID_CREDENTIALS'?HttpStatus.UNAUTHORIZED
 :code==='FORBIDDEN'||code==='CREDENTIAL_CHANGE_REQUIRED'?HttpStatus.FORBIDDEN
 :code==='NOT_FOUND'?HttpStatus.NOT_FOUND
 :code==='CONFLICT'?HttpStatus.CONFLICT
 :HttpStatus.INTERNAL_SERVER_ERROR;

@Catch(PlatformError,ContractValidationError)
export class PlatformErrorFilter implements ExceptionFilter<PlatformError|ContractValidationError>{
 catch(error:PlatformError|ContractValidationError,host:ArgumentsHost){
  const response=host.switchToHttp().getResponse<HttpResponse>();
  if(error instanceof ContractValidationError){response.status(HttpStatus.BAD_REQUEST).json({code:'VALIDATION_ERROR',message:error.message,field:error.field});return;}
  response.status(statusFor(error.code)).json({code:error.code,message:error.message,details:error.details});
 }
}
