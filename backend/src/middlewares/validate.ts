import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await schema.safeParseAsync(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: 'Validation Error',
          details: result.error.flatten().fieldErrors
        });
      }
      // Re-assign body with parsed data to strip unknown keys!
      req.body = result.data; 
      next();
    } catch (error) {
      next(error);
    }
  };
};
