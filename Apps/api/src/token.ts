import type { Request } from 'express';

export function extractBearerToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : undefined;
}
