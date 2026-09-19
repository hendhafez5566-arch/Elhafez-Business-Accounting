import { createHash } from 'crypto';

export async function sha256Hash(data: string): Promise<string> {
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}
