import'reflect-metadata';
import{NestFactory}from'@nestjs/core';
import{AppModule}from'./app.module.js';
import{GlobalRequestSafetyPipe}from'./global-request-safety.pipe.js';

type HeaderResponse={setHeader(name:string,value:string):void};
function allowedOrigins(){return new Set((process.env.ELHAFEZ_CORS_ORIGINS??'').split(',').map(value=>value.trim()).filter(Boolean));}
async function bootstrap():Promise<void>{
 const app=await NestFactory.create(AppModule);
 app.useGlobalPipes(new GlobalRequestSafetyPipe());
 app.use((_request:unknown,response:HeaderResponse,next:()=>void)=>{response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('X-Frame-Options','DENY');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');response.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");next();});
 const origins=allowedOrigins();
 if(origins.size)app.enableCors({origin:(origin,callback)=>{if(!origin||origins.has(origin))callback(null,true);else callback(new Error('origin is not allowed'),false);},credentials:false,methods:['GET','POST','PATCH','DELETE','OPTIONS'],allowedHeaders:['authorization','content-type','x-company-id','x-branch-id','x-owner-totp','x-saas-bootstrap-token'],maxAge:600});
 await app.listen(Number(process.env.PORT??3000),'0.0.0.0');
}
void bootstrap();
