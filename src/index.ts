import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as express from 'express';
import * as mongoose from 'mongoose';
import * as Sentry from '@sentry/node';
import './sentry';
import {NextFunction, Request, Response} from './types';
import shortner from './shortener';
import auth from './auth';
import {error} from './errors';

const app = express();
const PORT = process.env.PORT || 8080;
const STATIC = path.resolve(__dirname, '../static');
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
const ENVIRONMENT = process.env.NODE_ENV || 'production';
const HTTPS_CERT_PATH = ''; // config.httpsCertPath;
const MONGO_URI = process.env.CUSTOMCONNSTR_MONGO_URI || process.env.MONGO_URI;

console.log(`Setting environment as ${ENVIRONMENT}`);

// Yes I know this whole connection URL thing is a mess...
const PARSED_MONGO_URI = new URL(MONGO_URI);
const MONGO_HOST = PARSED_MONGO_URI.protocol + '//' + PARSED_MONGO_URI.host + PARSED_MONGO_URI.pathname + PARSED_MONGO_URI.search;
console.log('Connecting to MongoDB at', MONGO_HOST);

mongoose.connect(MONGO_HOST, {
  auth: (PARSED_MONGO_URI.username || PARSED_MONGO_URI.password) && {
    password: PARSED_MONGO_URI.password,
    user: PARSED_MONGO_URI.username
  }
})
  .then(() => console.log('Connected to MongoDB!'))
  .catch(e => {throw e; });
mongoose.connection.on('error', e => {
  Sentry.captureException(e);
});

app.use(Sentry.Handlers.requestHandler());
app.get('/', (req: Request, res: Response) => {
  res.sendFile(STATIC + '/home.html');
});
app.get('/config.json', (_, res: Response) => {
  res.json({
    auth: '/auth/1',
    shortener: '/shortener/1',
    success: true
  });
});
app.use('/shortener/1', shortner);
app.use('/auth/1', auth);
app.use('/static/background.jpg', (_, res: Response) => res.sendFile(STATIC + '/background.jpg'));
// app.get('/:id', redirector); // Redirects are now handled by a separate app
app.use((_, res: Response) => res.status(404).sendFile(STATIC + '/404.html'));
app.use(Sentry.Handlers.errorHandler());
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if(ENVIRONMENT === 'development') console.log(err);
  res.status(500).json(error('InternalError', null, res.sentry));
});

// Setup the appropriate servers (HTTP only in prod, HTTPS connections are terminated before app)
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
