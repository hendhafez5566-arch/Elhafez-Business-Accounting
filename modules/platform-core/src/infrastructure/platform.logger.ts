/** Structured logging boundary. Callers must provide safe, non-secret metadata only. */
export interface PlatformLogger { info(event: string, metadata?: Record<string, unknown>): void; error(event: string, metadata?: Record<string, unknown>): void; }
export class ConsolePlatformLogger implements PlatformLogger {
  info(event: string, metadata: Record<string, unknown> = {}): void { console.info(JSON.stringify({ level: 'info', event, metadata })); }
  error(event: string, metadata: Record<string, unknown> = {}): void { console.error(JSON.stringify({ level: 'error', event, metadata })); }
}
