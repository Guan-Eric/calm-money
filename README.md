# Calm Money

*Working title — product name TBD.*

A calm spending app: see where your money goes without guilt. Built with **Expo**, **React Native**, **Uniwind**, **Firebase**, **Plaid**, and **RevenueCat**.

**North star:** opening the app should feel like checking the weather, not opening a report card.

All design decisions filter through [CONSTITUTION.md](./CONSTITUTION.md).

## Stack

- Expo Router + Uniwind (Tailwind v4)
- Firebase Auth (email + Apple), Firestore, Cloud Functions
- Plaid Link (multi-country bank sync) — Pro
- RevenueCat (`premium` entitlement)
- Light categorization: merchant memory → heuristics → Plaid map → Other
- Couple sharing with opt-in visibility — Pro
- Calm Expo push notifications only

## Setup

1. Copy env:
   ```bash
   cp .env.example .env
   ```
   Firebase for project `calm-money-app` is already wired in `.env` if you kept it. Add RevenueCat public keys when ready.

2. **Firebase Console (required once)**  
   - Authentication → Sign-in method → enable **Email/Password**  
   - Authentication → Sign-in method → enable **Apple** (Services ID, key, return URLs — see Phase A below)  
   - [Upgrade to Blaze](https://console.firebase.google.com/project/calm-money-app/usage/details) to deploy Cloud Functions

3. Install & run:
   ```bash
   npm install
   npx expo start
   ```
   Plaid + RevenueCat purchases need a **dev client** (`npx expo run:ios` / EAS), not Expo Go.

4. Deploy backend (after Blaze + `firebase login`):
   ```bash
   npx -y firebase-tools@latest login --reauth
   npx -y firebase-tools@latest use calm-money-app
   # Generate encryption key once: openssl rand -base64 32
   export PLAID_CLIENT_ID=... PLAID_SECRET=... PLAID_ENV=sandbox
   export TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)"
   ./scripts/set-function-secrets.sh
   cd functions && npm install && npm run build && cd ..
   npx -y firebase-tools@latest deploy --only firestore,functions
   ```

5. Local Pro testing without store:
   ```
   EXPO_PUBLIC_MOCK_PREMIUM=true
   ```

## Phase A — Ops (ship blockers)

### Firebase Blaze + Functions
1. Upgrade `calm-money-app` to Blaze in the Firebase console.
2. Set secrets via `./scripts/set-function-secrets.sh` (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `TOKEN_ENCRYPTION_KEY`).
3. Deploy: `npx firebase-tools@latest deploy --only firestore,functions --project calm-money-app`.

### Apple Sign-In
1. Apple Developer → Identifiers → create **Services ID** for Sign in with Apple (bundle `com.calmmoney.app`).
2. Create a Sign in with Apple key; download `.p8`.
3. Firebase Auth → Sign-in method → Apple → enable; paste Services ID, Team ID, Key ID, private key.
4. Return URL from Firebase into Apple Services ID configuration.

### Dev client / EAS
1. EAS project is linked (`extra.eas.projectId` in `app.json`).
2. Build a development client (Plaid Link + purchases need native modules):
   ```bash
   npx expo run:ios
   # or, when EAS iOS build quota allows:
   npx eas build --profile development --platform ios
   ```
3. `eas.json` has a `development` profile with `developmentClient: true`.

### Plaid secrets
Placeholder secrets were set so Functions could deploy. Replace with real Sandbox credentials:
```bash
export PLAID_CLIENT_ID=... PLAID_SECRET=... PLAID_ENV=sandbox
export TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)"  # only if rotating
./scripts/set-function-secrets.sh
npx firebase-tools@latest deploy --only functions --project calm-money-app
```

## App structure

- `app/` — Expo Router screens (auth, calendar, add, settings, sharing, bank, pro, invite deep link)
- `src/lib/` — Firebase, transactions, categorization, Plaid, purchases, notifications, bank
- `src/components/` — UI + spending calendar + category breakdown
- `functions/` — Plaid link/exchange/sync (encrypted tokens), invites, leave household, weekly digest

## Free vs Pro

| Free | Pro |
|------|-----|
| Calendar + manual entry | Bank sync (Plaid) |
| Current-year history | Couple sharing |
| Calm notification prefs | Longer history |

## Status

Plan B MVP + remaining functionality product code. Phase A ops need console login (Blaze, secrets deploy, Apple provider, EAS project id).
