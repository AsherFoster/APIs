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
  adminPanel: string;
  jwtSecret: string; // Secret used when signing JWTs
  httpsCertPath?: string; // Path to HTTPS private key and cert
  homepage: {
    type: 'file'|'redirect';
    path: string;
  };
  mongoHost: string;
  sentry: {
    dsn: string;
  };
}

