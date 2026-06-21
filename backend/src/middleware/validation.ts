import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { logger } from '../utils/logger';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      logger.warn(`Validation failed for ${req.method} ${req.path}: ${errors}`);
      return res.status(400).json({
        success: false,
        message: `请求参数验证失败: ${errors}`
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      logger.warn(`Params validation failed for ${req.method} ${req.path}: ${errors}`);
      return res.status(400).json({
        success: false,
        message: `路径参数验证失败: ${errors}`
      });
    }
    req.params = result.data as typeof req.params;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      logger.warn(`Query validation failed for ${req.method} ${req.path}: ${errors}`);
      return res.status(400).json({
        success: false,
        message: `查询参数验证失败: ${errors}`
      });
    }
    next();
  };
}
