#!/usr/bin/env bash

npm i @sentry/cli

SENTRY_CLI=./node_modules/.bin/sentry-cli
VERSION=$(${SENTRY_CLI} releases propose-version)

# Create a release
${SENTRY_CLI} releases new -p apis ${VERSION}

npm test && npm run build

${SENTRY_CLI} releases finalize ${VERSION}

# Associate commits with the release
${SENTRY_CLI} releases set-commits --auto ${VERSION}
