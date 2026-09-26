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

@Catch(PlatformError)
export class PlatformErrorFilter implements ExceptionFilter<PlatformError>{
 catch(error:PlatformError,host:ArgumentsHost){
  const response=host.switchToHttp().getResponse<HttpResponse>();
  response.status(statusFor(error.code)).json({code:error.code,message:error.message,details:error.details});
 }
}
