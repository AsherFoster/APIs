#!/bin/bash

# ----------------------
# KUDU Deployment Script
# Version: 1.0.17
# ----------------------

# Helpers
# -------

exitWithMessageOnError () {
  if [ ! $? -eq 0 ]; then
    echo "An error has occurred during web site deployment."
    echo $1
    exit 1
  fi
}

# Prerequisites
# -------------

# Verify node.js installed
hash node 2>/dev/null
exitWithMessageOnError "Missing node.js executable, please install node.js, if already installed make sure it can be reached from current environment."

# Setup
# -----

DEPLOY_START=$(date +%FT%T%z)
SCRIPT_DIR="${BASH_SOURCE[0]%\\*}"
SCRIPT_DIR="${SCRIPT_DIR%/*}"
ARTIFACTS=$SCRIPT_DIR/../artifacts
KUDU_SYNC_CMD=${KUDU_SYNC_CMD//\"}

if [[ ! -n "$DEPLOYMENT_SOURCE" ]]; then
  DEPLOYMENT_SOURCE=$SCRIPT_DIR
fi

if [[ ! -n "$NEXT_MANIFEST_PATH" ]]; then
  NEXT_MANIFEST_PATH=$ARTIFACTS/manifest

  if [[ ! -n "$PREVIOUS_MANIFEST_PATH" ]]; then
    PREVIOUS_MANIFEST_PATH=$NEXT_MANIFEST_PATH
  fi
fi

if [[ ! -n "$DEPLOYMENT_TARGET" ]]; then
  DEPLOYMENT_TARGET=$ARTIFACTS/wwwroot
else
  KUDU_SERVICE=true
fi

if [[ ! -n "$KUDU_SYNC_CMD" ]]; then
  # Install kudu sync
  echo Installing Kudu Sync
  npm install kudusync -g --silent
  exitWithMessageOnError "npm failed"

  if [[ ! -n "$KUDU_SERVICE" ]]; then
    # In case we are running locally this is the correct location of kuduSync
    KUDU_SYNC_CMD=kuduSync
  else
    # In case we are running on kudu service this is the correct location of kuduSync
    KUDU_SYNC_CMD=$APPDATA/npm/node_modules/kuduSync/bin/kuduSync
  fi
fi

# Node Helpers
# ------------

selectNodeVersion () {
  if [[ -n "$KUDU_SELECT_NODE_VERSION_CMD" ]]; then
    SELECT_NODE_VERSION="$KUDU_SELECT_NODE_VERSION_CMD \"$DEPLOYMENT_SOURCE\" \"$DEPLOYMENT_TARGET\" \"$DEPLOYMENT_TEMP\""
    eval $SELECT_NODE_VERSION
    exitWithMessageOnError "select node version failed"

    if [[ -e "$DEPLOYMENT_TEMP/__nodeVersion.tmp" ]]; then
      NODE_EXE=`cat "$DEPLOYMENT_TEMP/__nodeVersion.tmp"`
      exitWithMessageOnError "getting node version failed"
    fi

    if [[ -e "$DEPLOYMENT_TEMP/__npmVersion.tmp" ]]; then
      NPM_JS_PATH=`cat "$DEPLOYMENT_TEMP/__npmVersion.tmp"`
      exitWithMessageOnError "getting npm version failed"
    fi

    if [[ ! -n "$NODE_EXE" ]]; then
      NODE_EXE=node
    fi

    NPM_CMD="\"$NODE_EXE\" \"$NPM_JS_PATH\""
  else
    NPM_CMD=npm
    NODE_EXE=node
  fi
}

##################################################################################################################################
# Deployment
# ----------

echo Handling node.js deployment.

# 1. KuduSync
if [[ "$IN_PLACE_DEPLOYMENT" -ne "1" ]]; then
  "$KUDU_SYNC_CMD" -v 50 -f "$DEPLOYMENT_SOURCE" -t "$DEPLOYMENT_TARGET" -n "$NEXT_MANIFEST_PATH" -p "$PREVIOUS_MANIFEST_PATH" -i ".git;.hg;.deployment;deploy.sh"
  exitWithMessageOnError "Kudu Sync failed"
fi

# 2. Select node version
selectNodeVersion

# 3. Install npm packages
if [ -e "$DEPLOYMENT_TARGET/package.json" ]; then
  cd "$DEPLOYMENT_TARGET"
  echo "Running $NPM_CMD install --production=false --scripts-prepend-node-path"
  eval NODE_ENV=installing $NPM_CMD install --production=false --scripts-prepend-node-path
  exitWithMessageOnError "npm failed"
  echo "Installed Packages:"
  eval $NPM_CMD ls --depth=0
  cd - > /dev/null
fi

# Compile Typescript
echo "Compiling TypeScript in $DEPLOYMENT_TARGET..."
"$NODE_EXE" "${DEPLOYMENT_TARGET}\node_modules\typescript\bin\tsc" -p "$DEPLOYMENT_TARGET"
exitWithMessageOnError "failed to compile typescript"

echo "Marking as deployed via Sentry"
VERSION=$(git rev-parse HEAD)
curl -X POST \
  "https://sentry.io/api/0/organizations/${SENTRY_ORG}/releases/${VERSION}/deploys/" \
  -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
	"environment": "'${NODE_ENV}'",
	"name": "'${VERSION}'",
	"dateStarted": "'${DEPLOY_START}'",
	"dateFinished": "'$(date +%FT%T%z)'"
}'

# Please, please let one of these work
export GIT_HASH=${VERSION}
echo ${VERSION} > ${DEPLOYMENT_TARGET}/version.txt

##################################################################################################################################

# Post deployment stub
if [[ -n "$POST_DEPLOYMENT_ACTION" ]]; then
  POST_DEPLOYMENT_ACTION=${POST_DEPLOYMENT_ACTION//\"}
  cd "${POST_DEPLOYMENT_ACTION_DIR%\\*}"
  "$POST_DEPLOYMENT_ACTION"
  exitWithMessageOnError "post deployment action failed"
fi

echo "Finished successfully."
