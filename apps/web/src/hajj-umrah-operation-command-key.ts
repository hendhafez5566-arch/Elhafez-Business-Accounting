export function makeOperationCommandKey(operation:string,entityId:string,qualifier:string=''){return ['hu02',operation,entityId,qualifier].map(value=>encodeURIComponent(value)).join(':');}
