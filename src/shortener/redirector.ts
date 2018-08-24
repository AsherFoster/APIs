import {NextFunction, Request, Response} from 'express';
import {Redirect} from './redirect';
import {error} from '../errors';

export async function redirector(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = req.params.id;
    const redirect = await Redirect.findOne({id});
    console.log(`[${new Date()}] ${req.path} - ${redirect ? 'found' : 'not found'}`);
    if(!redirect) {
        next();
        return;
    }
    if(redirect.type !== 'redirect') {
        res.status(500).json(error('InternalError'));
        return;
    }
    res.redirect(redirect.action.destination);
}
