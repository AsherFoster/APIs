import {Router} from 'express';
import {Request, Response} from '../types';
import * as bodyParser from 'body-parser';
import * as bcrypt from 'bcrypt';
import * as cors from 'cors';
import User from './user';
import {error} from '../errors';
import {requiresAuth, createJwt, authenticate} from './authenticate';

const router = Router();

// Use a 503 on Not Implemented yet

router
  .use(cors())
  .use(authenticate)
  /**
   * Exchanges email + password for a signed JWT (token)
   * POST:
   *  - email: string
   *  - password: string
   * RESPONSE:
   *  - success: true
   *  - token: string
   *  - user: PublicUser
   * */
  .post('/authorize', requiresAuth, bodyParser.json(), async (req: Request, res: Response) => {
    const {email, password} = req.body;
    if(!email) return res.status(400).json(error('InvalidParam', 'email field is required'));
    if(!password) return res.status(400).json(error('InvalidParam', 'password field is required'));

    const user = await User.findOne({email});
    if(!user) return res.status(401).json(error('AuthorizationFailed'));
    const valid = await user.checkPassword(password);
    if(!valid) return res.status(401).json(error('AuthorizationFailed'));

    const token = await createJwt(user);
    user.lastLogin = new Date();
    await user.save();
    console.log(`New token issued for ${user.name} (${user.id}) -- ${token}`);
    res.json({
      success: true,
      token,
      user: user.publicUser()
    });
  })
  /**
   * Gets a simple list of users
   * RESPONSE:
   *  - success: true
   *  - users: PublicUser[]
   * */
  .get('/users', requiresAuth, async (req: Request, res: Response) => {
    const users = await User.find({});
    res.json({
      success: true,
      users: users.map(u => u.publicUser())
    });
  })
  /**
   * Creates a new user. POST with user data
   * POST:
   *  - email: string
   *  - name: string // Display name
   *  - password: string // Plaintext password
   *
   * RESPONSE:
   *  - success: true
   *  - user: PublicUser
   * */
  .post('/users', requiresAuth, bodyParser.json(), async (req: Request, res: Response) => {
    if(!req.body.email) return res.status(400).send(error('InvalidParam', 'User requires an email'));
    if(!req.body.name) return res.status(400).send(error('InvalidParam', 'User requires a name'));
    if(!req.body.password) return res.status(400).send(error('InvalidParam', 'Must set a password for user'));
    const clash = await User.findOne({email: req.body.email});
    if(clash) return res.status(409).send(error('IdConflict', 'That email has already been used!'));

    const passwordHash = await bcrypt.hash(req.body.password, 10);

    const user = new User({
      created: new Date(),
      email: req.body.email,
      id: Math.random().toString(36).substr(2, 8),
      name: req.body.name,
      password: passwordHash
    });
    await user.save();
    res.json({
      success: true,
      user: user.publicUser()
    });
  })
  /**
   * Gets a given user
   * PATH:
   *  - id: string // ID of user to fetch info about
   *
   *  RESPONSE:
   *   - success: true
   *   - redirect: RestUser
   * */
  .get('/users/:id', requiresAuth, async (req: Request, res: Response) => {
    let user;
    if(req.params.id === 'me') user = req.user;
    else user = await User.findOne({id: req.params.id});
    if(!user) {
      return res.status(404).json(error('ObjectNotFound'));
    }
    res.send({
      success: true,
      user: user.publicUser()
    });
  })
  /**
   * Updates a given user
   * PATH:
   *  - id: string // ID of user to update
   *
   * POST:
   *  - email?: string
   *  - name?: string
   *  - password?: string
   *
   *  RESPONSE:
   *   - success: true
   *   - user: PublicUser
   *  */
  .patch('/users/:id', requiresAuth, bodyParser.json(), async (req, res) => {
    const id = req.params.id;
    const user = await User.findOne({id});
    if (!user) return res.send(404).json(error('ObjectNotFound'));
    const {name, password, email} = req.body;
    if(!(name || password || email)) {
      return res.status(400).json(error('InvalidParam', 'Something must be updated!'));
    }
    if(password) user.password = await bcrypt.hash(password, 10);
    if(name) user.name = name;
    if(email) user.email = email;
    await user.save();
    res.json({
      success: true,
      user: user.publicUser()
    });
  })
  /**
   * Deletes a user
   * PATH:
   *  - id: string // User id to delete
   * RESPONSE:
   *  - success: true
   * */
  .delete('/users/:id', requiresAuth, async (req: Request, res: Response) => {
    if(req.params.id === 'me' || req.params.id === req.user.id) {
      return void res.status(503).json(error('NotImplemented', 'You can\'t delete yourself yet.'));
    }
    const user = await User.findOne({id: req.params.id}); // Limit just in case
    if(!user) {
      return res.status(404).send(error('ObjectNotFound'));
    }
    if (await User.count({}) <= 1) {
      return void res.status(400).json(error('InvalidParam', 'You can\'t delete the last user. (Yet)'));
    }
    await User.deleteOne({id: req.params.id});
    res.send({
      success: true
    });
  })
  /**
   * Revokes all tokens by only accepting ones issued after this request
   * RESPONSE:
   *  - success: true
   *  - firstJwt: Date
   * */
  .post('/users/:id/revoke', requiresAuth, async (req: Request, res: Response) => {
    const user = await getUserFromParam(req);
    if(!user) return res.status(404).json(error('ObjectNotFound'));
    user.firstJwt = new Date();
    await user.save();
    res.json({
      firstJwt: user.firstJwt,
      success: true
    });
  })
;

export async function getUserFromParam(req: Request, name: string = 'id'): Promise<User|null> {
  if(req.params[name] === 'me') return req.user;
  else return await User.findOne({id: req.params[name]});
}

export default router;
