import {
  Request as ExRequest,
  Response as ExResponse,
  NextFunction as ExNextFunction,
} from 'express';
import User from './auth/user';

export interface Request extends ExRequest {
  user?: User;
}

export interface Response extends ExResponse {
  sentry: any;
}

export type NextFunction = ExNextFunction;
