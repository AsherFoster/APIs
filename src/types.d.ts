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

export interface Config {
  httpsCertPath?: string; // Path to HTTPS private key and cert
  homepage: {
    type: 'file'|'redirect';
    path: string;
  };
}

