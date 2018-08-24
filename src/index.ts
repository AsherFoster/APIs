import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as express from 'express';
import * as mongoose from 'mongoose';
import * as Raven from 'raven';
import {NextFunction, Request, Response} from './types';
import shortner from './shortener';
import auth from './auth';
import {redirector} from './shortener/redirector';
import config from './config';
import {error} from './errors';

Raven.config(config.sentry.dsn, {
  autoBreadcrumbs: true,
  captureUnhandledRejections: true
}).install();

// Context:
// TODO Node ver

const app = express();
const PORT = process.env.PORT || 8080;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
const ENVIRONMENT = process.env.NODE_ENV || 'production';
const HTTPS_CERT_PATH = config.httpsCertPath;

console.log(`Setting environment as ${ENVIRONMENT}`);

mongoose.connect(config.mongoHost);
mongoose.connection.on('error', e => {
  Raven.captureException(e);
});

app.use(Raven.requestHandler());
app.get('/', (req: Request, res: Response) => {
  if(config.homepage.type === 'file') {
    res.sendFile(path.resolve(__dirname, '../', config.homepage.path));
  } else if(config.homepage.type === 'redirect') {
    res.redirect(config.homepage.path, 301);
  } else res.sendStatus(500);
});
app.get('/config.json', (req: Request, res: Response) => {
  res.json({
    auth: '/auth/1',
    shortener: '/shortner/1',
    success: true
  });
});
app.use('/shortener/1', shortner);
app.use('/auth/1', auth);
app.use('/manage', express.static(config.adminPanel));
app.get('/:id', redirector);
app.get('/sentry', () => {throw new Error('Sentry demo!'); });
app.use((req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, '../static/404.html'));
});
app.use(Raven.errorHandler());
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    error: error('InternalError', null, res.sentry),
    success: false
  });
});

// Setup the appropriate servers
if(HTTPS_CERT_PATH) {
  const httpsServer = https.createServer({
    cert: fs.readFileSync(HTTPS_CERT_PATH + '.crt', 'utf8'),
    key: fs.readFileSync(HTTPS_CERT_PATH + '.key', 'utf8')
  }, app);
  httpsServer.listen(HTTPS_PORT, () => console.log('HTTPS server listening on port ' + HTTPS_PORT));
  http.createServer((req, res) => {
    res.writeHead(301, { 'Location': 'https://' + req.headers.host + req.url });
    res.end();
  }).listen(PORT, () => console.log('HTTP server redirecting on port ' + PORT));
} else {
  app.listen(PORT, () => console.log(`HTTP server running on port ` + PORT));
}
