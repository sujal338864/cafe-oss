import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

export const logContext = new AsyncLocalStorage<{ requestId: string }>();

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format((info) => {
      const store = logContext.getStore();
      if (store?.requestId) {
        info.requestId = store.requestId;
      }
      return info;
    })(),
    winston.format.json()
  ),
  defaultMeta: { service: 'shop-os-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
