#!/usr/bin/env bash
# Production / preview ship checklist for Tally (console + EAS steps).
# Client code is gated for prod; this verifies ops before store submission.
set -euo pipefail
cat <<'EOF'
Tally — production checklist
============================

Builds (eas.json)
-----------------
  development  MOCK_PREMIUM=true   Test Store OK   Plaid sandbox   dev client
  preview      MOCK_PREMIUM=false  Test Store OK   Plaid sandbox   internal
  production   MOCK_PREMIUM=false  appl_/goog_     Plaid production

  npx eas build --profile development --platform ios
  npx eas build --profile preview --platform ios
  npx eas build --profile production --platform ios

  Production RC keys (set as EAS secrets, do not commit):
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_…
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_…

Firebase Auth — Apple
---------------------
  See: ./scripts/apple-signin-checklist.sh
  Verify Sign in with Apple on a device build before App Store review.

Plaid (Cloud Functions secrets)
-------------------------------
  Dev / preview:
    PLAID_ENV=sandbox + sandbox client id/secret
  Production:
    PLAID_ENV=production + live credentials
    ./scripts/set-function-secrets.sh
    npx firebase-tools@latest deploy --only functions --project calm-money-app
  TOKEN_ENCRYPTION_KEY: set once; do not rotate without a migration plan.

RevenueCat
----------
  Preview: test_… keys OK — see docs/revenuecat-setup.md
  Production: create App Store + Play apps in RevenueCat; use appl_/goog_ in EAS secrets
  Entitlement id: premium
  Server: REVENUECAT_SECRET_API_KEY=sk_… so syncPremiumStatus can verify purchases

App Store / Play (production only)
----------------------------------
  [ ] Privacy Policy URL
  [ ] IAP products linked to RevenueCat offering
  [ ] Screenshots + description (Tally — Money planner)
  [ ] Sign in with Apple entitlement on App ID com.calmmoney.app
  [ ] Production APNs / FCM via Expo for push

Verify before calling ready
---------------------------
  [ ] npm run lint
  [ ] Auth persists across relaunch
  [ ] Mock Pro only in __DEV__ + development profile
  [ ] Production env: MOCK_PREMIUM false; RC keys not test_
  [ ] Apple Sign-In on device
  [ ] Plaid sandbox on preview; production Plaid only after secret rotation
  [ ] Home screen icon + splash look correct
EOF
