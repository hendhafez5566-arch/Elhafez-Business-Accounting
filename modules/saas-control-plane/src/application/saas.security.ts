export interface MfaSecretProtector {seal(secret:string):string;open(ciphertext:string):string}
export interface BootstrapTokenVerifier {verify(provided:string):boolean}
