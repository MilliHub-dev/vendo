import { z } from 'zod';

export class ApiError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), request_id: z.string() }),
});

export const errorResponses = {
  400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 409: errorSchema,
  413: errorSchema, 429: errorSchema, 500: errorSchema, 503: errorSchema,
};
