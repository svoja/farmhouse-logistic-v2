#!/bin/bash
# Run on server after deploy.ps1 has copied files.
# Expects: DEPLOY_PATH set (e.g. /opt/logistic_OS_v2)

set -e
DEPLOY_PATH="${DEPLOY_PATH:-/opt/logistic_OS_v2}"
cd "$DEPLOY_PATH"

echo "Installing production dependencies in $DEPLOY_PATH..."
npm install --omit=dev

echo "Server setup complete."
echo "Next: configure .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME_V2), import database, then run: node server/index.js"
