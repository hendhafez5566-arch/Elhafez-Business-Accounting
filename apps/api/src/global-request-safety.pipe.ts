import{BadRequestException,Injectable,type ArgumentMetadata,type PipeTransform}from'@nestjs/common';
const BLOCKED_KEYS=new Set(['__proto__','prototype','constructor']);
export interface RequestSafetyLimits{readonly maxDepth:number;readonly maxArrayItems:number;readonly maxObjectKeys:number;readonly maxStringLength:number}
export const DEFAULT_REQUEST_SAFETY_LIMITS:RequestSafetyLimits=Object.freeze({maxDepth:24,maxArrayItems:10000,maxObjectKeys:5000,maxStringLength:2_000_000});
@Injectable()
export class GlobalRequestSafetyPipe implements PipeTransform{
 constructor(private readonly limits:RequestSafetyLimits=DEFAULT_REQUEST_SAFETY_LIMITS){}
 transform(value:unknown,_metadata:ArgumentMetadata){this.validate(value,0);return value}
 private validate(value:unknown,depth:number):void{
  if(depth>this.limits.maxDepth)throw new BadRequestException('request payload is too deeply nested');
  if(value===null||value===undefined||typeof value==='boolean')return;
  if(typeof value==='number'){if(!Number.isFinite(value))throw new BadRequestException('request contains a non-finite number');return}
  if(typeof value==='string'){if(value.length>this.limits.maxStringLength)throw new BadRequestException('request string is too large');return}
  if(Array.isArray(value)){if(value.length>this.limits.maxArrayItems)throw new BadRequestException('request array is too large');for(const item of value)this.validate(item,depth+1);return}
  if(typeof value==='object'){const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)throw new BadRequestException('request contains an unsupported object type');const entries=Object.entries(value);if(entries.length>this.limits.maxObjectKeys)throw new BadRequestException('request object has too many fields');for(const[key,item]of entries){if(BLOCKED_KEYS.has(key))throw new BadRequestException('request contains a blocked property');this.validate(item,depth+1)}return}
  throw new BadRequestException('request contains an unsupported value');
 }
}
