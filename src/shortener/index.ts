import {Router} from 'express';
import bodyParser = require('body-parser');
import Redirect from './redirect';
import * as cors from 'cors';
import {error} from '../errors';
import {Request, Response} from '../types';
import {authenticate, requiresAuth} from '../auth/authenticate';

export interface RestRedirect {
  id: string;
  action: any;
  created: Date;
  creator: string;
  type: string;
  updated: Date;
  updater: string;
}

const router = Router();

function forceOption<T>(choice: T, options: T[]): T {
  return options.indexOf(choice) > -1 ? choice : options[0];
}

router
  .use(cors())
  .use(authenticate)
  /**
   * Creates a redirect. POST with redirect data, and auth (wip)
   * POST:
   *  - destination: string // Where it'll redirect to
   *  - id: string // URL to match in order to redirect
   *
   * RESPONSE:
   *  - success: true
   *  - redirect
   *   - id: string
   *   - action
   *    - destination: string
   *   - type: string
   * */
  .post('/redirects', requiresAuth, bodyParser.json(), async (req: Request, res: Response) => {
    let id = req.body.id || Math.random().toString(36).substr(2, 6);
    if (!req.body.destination) return res.status(400).json(error('InvalidParam', 'Destination must be provided'));
    if (await Redirect.findOne({id}, {id: 1})) {
      if (!req.body.id) {
        console.error('Holy crap, did two random IDs just collide?!', id);
        res.status(500).json(error('InternalError'));
      }
      res.status(409).json(error('IdConflict'));
      return;
    }
    const redirect = new Redirect({
      action: {
        destination: req.body.destination
      },
      created: new Date(),
      creator: req.user.id,
      id: id,
      type: 'redirect'
    });
    await redirect.save();
    res.json({
      redirect,
      success: true
    });
  })
  /**
   * Lists redirects. Will use pagination, currently just serves everything on one page
   * QUERY:
   *  - start: Date // Only entries with timestamps *after* here will be retrieved
   *  - limit: number // Capped at arbitrary int. Defaults to max?
   *  - sort: string // What to sort by
   *  - ascending: boolean // Old - New, or New - Old. Defaults to New-Old or A-Z
   * RESPONSE:
   *  - success: boolean
   *  - redirects: Redirect[]
   *  - paging:
   *   - prev: Date|null // Found by query previous page too? idk
   *   - next: Date|null // Date of last item. start query param is non-inclusive, so will work
   *   - self: Date
   *   - pages: number // Amount of pages
   *   - total: number // Amount of redirects
   * */
  .get('/redirects', requiresAuth, async (req: Request, res: Response) => {
    // Figure out what to sort by
    const sortKey = forceOption(req.query.sort, ['created', 'updated']);
    // Figure out whether it's ascending
    let ascending;
    if (['true', 'false'].indexOf(req.query.ascending) > -1) {
      ascending = req.query.ascending === 'true';
    } else if (req.query.ascending) {
      res.status(400).json(error('InvalidParam', 'Invalid sort query param. Must be true or false'));
      return;
    } else {
      ascending = ['created', 'updated'].indexOf(sortKey) === -1; // If it's c/u then descend, otherwise ascend
    }
    // Parse the start, or default to now, or the start of time
    let start;
    if (req.query.start) {
      start = new Date(+req.query.start);
      if (isNaN(+start)) {
        res.status(400).json(error('InvalidParam', 'Invalid timestamp provided as start query param'));
        return;
      }
    } else {
      start = ascending ? new Date(1) : new Date();
    }
    // Figure out the page size
    const maxPageSize = 100;
    if (req.query.limit && (isNaN(req.query.limit) || +req.query.limit % 1)) {
      res.status(400).json(error('InvalidParam', 'Limit query param is not a valid integer'));
    }
    const limit = req.query.limit ? Math.min(maxPageSize, req.query.limit) : maxPageSize;
    //
    // Get the page
    const redirects = await Redirect
      .find({
        [sortKey]: {[ascending ? '$gt' : '$lt']: start} // Start from start, op depends on asc or desc
      })
      .sort({[sortKey]: ascending ? 1 : -1})
      .limit(limit + 1);
    const documentCount = await Redirect.find({}).count();
    const previousPage = await Redirect
      .find({
        [sortKey]: {[ascending ? '$lte' : '$gte']: start}
      })
      .sort({[sortKey]: ascending ? -1 : 1})
      .limit(limit + 1);
    const isEnd = redirects.length <= limit;
    res.json({
      paging: {
        next: redirects.length && !isEnd ? +(redirects[redirects.length - 2] as any)[sortKey] : null,
        pages: Math.ceil(documentCount / limit),
        prev: previousPage.length ? (+(previousPage[previousPage.length - 1] as any)[sortKey]) + (ascending ? -1 : 1) : null,
        self: redirects.length ? +(redirects[0] as any)[sortKey] - 1 : null,
        total: documentCount
      },
      redirects: isEnd ? redirects : redirects.slice(0, -1),
      success: true
    });
  })
  /**
   * Gets details about a given redirect
   * PATH:
   *  - id: string // Redirect ID to retrieve details for
   *
   *  RESPONSE:
   *   - success: true
   *   - redirect: RestRedirect
   * */
  .get('/redirects/:id', async (req: Request, res: Response) => {
    const redirect = await Redirect.findOne({id: req.params.id}, {
      _id: 0,
      action: 1,
      created: 1,
      creator: 1,
      id: 1,
      type: 1,
      updated: 1,
      updater: 1
    });
    if (redirect) {
      res.json(redirect);
    } else {
      res
        .status(404)
        .json(error('ObjectNotFound'));
    }
  })
  /**
   * Patches a given redirect with new data. Only part of the object needs to be provided
   *  PATH:
   *   - id: string // Redirect ID
   *
   *  RESPONSE:
   *   - sucesss: true
   *   - redirect: RestRedirect
   * */
  .patch('/redirects/:id', requiresAuth, bodyParser.json(), async (req: Request, res: Response) => {
    const redirect = await Redirect.findOne({id: req.params.id});
    if (redirect) {
      if (!req.body) {
        res.status(400).send(error('InvalidParam', 'Body must be provided'));
        return;
      }
      const updateData = req.body; // TODO: Validation, maybe?
      updateData.updated = new Date();
      updateData.updater = req.user.id;
      await redirect.set(req.body);
      res.json(redirect);
    } else {
      res.status(404).send(error('ObjectNotFound'));
    }
  })
  /**
   * Deletes a redirect
   * PATH:
   *  - id: string // Redirect id to delete
   * RESPONSE:
   *  - success: true
   * */
  .delete('/redirects/:id', requiresAuth, async (req: Request, res: Response) => {
    const redirect = await Redirect.findOne({id: req.params.id});
    if (redirect) {
      await redirect.remove();
      res.json({success: true});
    } else {
      res.status(404).json(error('ObjectNotFound'));
    }
  })
  /**
   * Method not found handler
   * RESPONSE:
   *  - success: false
   *  - error: Errors.MethodNotFound
   * */
  .use((req: Request, res: Response) => {
    res.status(404).json(error('MethodNotFound'));
  })
;

export default router;
