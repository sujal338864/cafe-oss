import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logContext } from '../lib/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.header('x-request-id') as string) || randomUUID();
  
  res.setHeader('x-request-id', requestId);

  logContext.run({ requestId }, () => {
    next();
  });
};
