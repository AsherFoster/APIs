import * as Sentry from '@sentry/node';
import {execSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'production';
let RELEASE;

if (process.env.OS === 'Windows_NT') {
    RELEASE = process.env.GIT_HASH
      || fs.readFileSync(path.resolve(__dirname, '../version.txt'), 'utf8').slice(0, -1) // Don't want the newline at the end
      || 'unknown'; // Probably will crash before here, anyway
} else {
  RELEASE = execSync('git rev-parse HEAD', {shell: '/bin/sh'}).toString().slice(0, -1);
}

Sentry.init({
  dsn: ENVIRONMENT === 'production' && SENTRY_DSN,
  release: RELEASE
});
