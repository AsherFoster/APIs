import * as Sentry from '@sentry/node';
import * as jwt from 'jsonwebtoken';
import {promisify} from 'util';
import User from './user';
import {Request, Response, NextFunction} from '../types';
import {error} from '../errors';

let SECRET = process.env.JWT_SECRET;
if(process.env.NODE_ENV === 'production' && !SECRET) {
  throw new Error('No JWT secret set!');
} else {
  SECRET = 'development';
}
const JWT_DURATION = 1000 * 60 * 60 * 24 * 28; // Four weeks? Sure.

export interface JWTPayload {
  exp: number; // Expiry
  iat: number; // Issued at
  name: string; // Name of bearer
  sub: string; // User ID of bearer
}

export async function validateJwt(token: string): Promise<User|null> {
  let payload;
  try {
    payload = await promisify(jwt.verify)(token, SECRET) as JWTPayload;
  } catch (e) {
    Sentry.addBreadcrumb({
      category: 'authentication',
      level: 'warning' as Sentry.Severity,
      message: 'Failed to parse token!'
    });
    return null;
  }
  if(payload.exp < Date.now()) return null; // Expired?
  const user = await User.findOne({id: payload.sub});
  if(!user) return null; // If it isn't a valid user
  if(+user.firstJwt > payload.iat) return null; // If it's been invalidated
  return user;
}

export async function createJwt(user: User): Promise<string> {
  const payload: JWTPayload = {
    exp: +new Date(Date.now() + JWT_DURATION),
    iat: +new Date(),
    name: user.name,
    sub: user.id
  };
  const token = await promisify<JWTPayload, string, string>(jwt.sign)(payload, SECRET);
  return token;
}

export async function renewJwt(token: string): Promise<string> {
  const user = await validateJwt(token);
  return createJwt(user);
}

export async function requiresAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if(!req.user) return void res.status(401).json(error('AuthorizationFailed'));
  next();
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization;
  if(!token) return void next();

  const user = await validateJwt(token);
  if(!user) return void next();
  Sentry.addBreadcrumb({
    category: 'authentication',
    data: {
      token: token.substr(5).substr(-10)
    },
    message: 'Authenticated User'
  });
  req.user = user;
  next();

}
