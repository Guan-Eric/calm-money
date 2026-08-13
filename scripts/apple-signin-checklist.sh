#!/usr/bin/env bash
# One-time Apple Sign-In checklist for Tally (console steps).
# Client code is already wired (expo-apple-authentication + Firebase OAuthProvider).
set -euo pipefail
cat <<'EOF'
Apple Sign-In setup (Tally)
===========================

This app uses the Firebase JS SDK + native Apple identity tokens.
The token `aud` claim is the running iOS bundle ID: com.calmmoney.app
Expo Go uses host.exp.Exponent — Apple Sign-In with Firebase will never work there.

1. Apple Developer → Identifiers → App ID com.calmmoney.app
   - Enable "Sign in with Apple"
   - Do NOT create a separate Services ID for this native-only app.
     Firebase JS Auth allows one Apple Service ID, and it MUST match the token
     audience (the bundle ID). A Services ID like com.calmmoney.app.signin
     will fail with auth/invalid-credential (audience mismatch).

2. Apple Developer → Keys
   - Create a key with "Sign in with Apple"
   - Restrict it to App ID com.calmmoney.app
   - Download the .p8 (shown once). Note Key ID.

3. Firebase Console → Project settings → Your apps
   - Add / confirm an iOS app with bundle ID com.calmmoney.app
   - Use that iOS app's GoogleService values in EXPO_PUBLIC_FIREBASE_* if needed

4. Firebase Console → Authentication → Sign-in method → Apple → Enable
   - Service ID: com.calmmoney.app   ← must equal the iOS bundle ID
   - Team ID: your Apple Developer Team ID (10 chars)
   - Key ID + private key (.p8 contents)
   - OAuth code flow is still required so Firebase can revoke tokens (Apple policy)
   - Skip a separate Services ID / Return URL unless you add a web client later

5. Rebuild the iOS binary so the Sign in with Apple entitlement is present
   (app.json already sets usesAppleSignIn + com.apple.developer.applesignin):
   npx expo run:ios
   # or: npx eas build --profile development --platform ios

Verify
------
- Sign-in screen shows the Apple button on a physical iOS device or simulator
- Button is hidden / blocked in Expo Go with a "development build" message
- First sign-in creates a Firebase user; relaunch stays signed in
- Decode the Apple identityToken at jwt.io — `aud` must be com.calmmoney.app

Common failures
---------------
- audience [host.exp.Exponent]     → running Expo Go; use a dev client
- audience [com.calmmoney.app.signin] vs expected bundle ID → Service ID mismatch
- auth/operation-not-allowed       → Apple provider not enabled in Firebase
- capability missing after config  → rebuild; confirm App ID has Sign in with Apple
EOF
