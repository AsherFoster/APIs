#!/usr/bin/env bash

npm test && npm run build
if [! $? -eq 0]; then
  echo Failed to test or build, refusing to build
  exit 1
fi

SENTRY_CLI=./node_modules/.bin/sentry-cli
VERSION=$(node -p "require('./package.json').version")
AUTHOR=$(node -p "require('./package.json').author")

# Create a release
${SENTRY_CLI} releases new -p apis ${VERSION}

docker build -t ashernz/apis .

docker commit -a ${AUTHOR} ${CONTAINER_ID} ashernz/apis:${VERSION}

${SENTRY_CLI} releases finalize ${VERSION}

# Associate commits with the release
${SENTRY_CLI} releases set-commits --auto ${VERSION}
