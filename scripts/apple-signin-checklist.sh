#!/usr/bin/env bash
# One-time Apple Sign-In checklist for Calm Money (console steps).
# Client code is already wired (expo-apple-authentication + Firebase OAuthProvider).
set -euo pipefail
cat <<'EOF'
Apple Sign-In setup
===================
1. Apple Developer → Certificates, Identifiers & Profiles
   - App ID com.calmmoney.app: enable "Sign in with Apple"
   - Create Services ID (e.g. com.calmmoney.app.signin)
   - Create Key with Sign in with Apple; download .p8

2. Firebase Console → Authentication → Sign-in method → Apple → Enable
   - Services ID, Team ID, Key ID, private key (.p8 contents)
   - Copy the callback URL Firebase shows into the Apple Services ID Return URLs

3. Rebuild the iOS app (dev client) so usesAppleSignIn entitlement is present:
   npx expo run:ios
   # or: npx eas build --profile development --platform ios

Verify: Sign-in screen shows Continue with Apple on a physical/simulator iOS device.
EOF
