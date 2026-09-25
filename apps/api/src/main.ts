import'reflect-metadata';
import{NestFactory}from'@nestjs/core';
import{AppModule}from'./app.module.js';
import{GlobalRequestSafetyPipe}from'./global-request-safety.pipe.js';

type HeaderResponse={setHeader(name:string,value:string):void};
type ExpressLike={disable?(setting:string):void};
function allowedOrigins(){return new Set((process.env.ELHAFEZ_CORS_ORIGINS??'').split(',').map(value=>value.trim()).filter(Boolean));}
async function bootstrap():Promise<void>{
 const app=await NestFactory.create(AppModule);
 (app.getHttpAdapter().getInstance() as ExpressLike).disable?.('x-powered-by');
 app.enableShutdownHooks();
 app.useGlobalPipes(new GlobalRequestSafetyPipe());
 app.use((_request:unknown,response:HeaderResponse,next:()=>void)=>{response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('X-Frame-Options','DENY');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');response.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");next();});
 const origins=allowedOrigins();
 if(origins.size)app.enableCors({origin:(origin:string|undefined,callback:(error:Error|null,allow?:boolean)=>void)=>{if(!origin||origins.has(origin))callback(null,true);else callback(new Error('origin is not allowed'),false);},credentials:false,methods:['GET','POST','PATCH','DELETE','OPTIONS'],allowedHeaders:['authorization','content-type','x-company-id','x-branch-id','x-owner-totp','x-saas-bootstrap-token'],maxAge:600});
 const port=Number(process.env.PORT??3000);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be a valid TCP port');
 const host=process.env.ELHAFEZ_BIND_HOST?.trim()||'127.0.0.1';
 await app.listen(port,host);
}
void bootstrap();
