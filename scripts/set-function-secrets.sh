#!/usr/bin/env bash
# Set Firebase Functions secrets for Tally.
# Usage:
#   export PLAID_CLIENT_ID=... PLAID_SECRET=... PLAID_ENV=sandbox
#   export TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)"
#   ./scripts/set-function-secrets.sh
set -euo pipefail
PROJECT="${FIREBASE_PROJECT:-calm-money-app}"

need() {
  if [[ -z "${!1:-}" ]]; then
    echo "Missing env var: $1" >&2
    exit 1
  fi
}

need PLAID_CLIENT_ID
need PLAID_SECRET
need PLAID_ENV
need TOKEN_ENCRYPTION_KEY

echo "Setting secrets on $PROJECT…"
printf '%s' "$PLAID_CLIENT_ID" | npx -y firebase-tools@latest functions:secrets:set PLAID_CLIENT_ID --project "$PROJECT" --data-file -
printf '%s' "$PLAID_SECRET" | npx -y firebase-tools@latest functions:secrets:set PLAID_SECRET --project "$PROJECT" --data-file -
printf '%s' "$PLAID_ENV" | npx -y firebase-tools@latest functions:secrets:set PLAID_ENV --project "$PROJECT" --data-file -
printf '%s' "$TOKEN_ENCRYPTION_KEY" | npx -y firebase-tools@latest functions:secrets:set TOKEN_ENCRYPTION_KEY --project "$PROJECT" --data-file -
echo "Done. Deploy with: npx firebase-tools@latest deploy --only functions --project $PROJECT"
