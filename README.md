# Tally

*Money planner — see where your money goes without guilt.*

Built with **Expo**, **React Native**, **Uniwind**, **Firebase**, **Plaid**, and **RevenueCat**.

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
   - Authentication → Sign-in method → enable **Apple** (see `./scripts/apple-signin-checklist.sh`)  
   - [Upgrade to Blaze](https://console.firebase.google.com/project/calm-money-app/usage/details) to deploy Cloud Functions

   RevenueCat dashboard mapping (products, entitlement `premium`, EAS keys, Functions secret): [docs/revenuecat-setup.md](./docs/revenuecat-setup.md).

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
   export PLAID_CLIENT_ID=... PLAID_SECRET=... PLAID_ENV=sandbox
   export TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32)"
   ./scripts/set-function-secrets.sh
   cd functions && npm install && npm run build && cd ..
   npx -y firebase-tools@latest deploy --only firestore,functions
   ```

5. Local Pro testing (development only — release builds ignore this flag):
   ```
   EXPO_PUBLIC_MOCK_PREMIUM=true
   ```

## Builds (EAS profiles)

| Profile | Mock Pro | RevenueCat | Plaid |
|---------|----------|------------|-------|
| `development` | on (`eas.json` env) | `test_…` OK | sandbox |
| `preview` | off | `test_…` OK until live | sandbox |
| `production` | off | `appl_` / `goog_` via EAS secrets | production |

```bash
npx eas build --profile development --platform ios
npx eas build --profile preview --platform ios
npx eas build --profile production --platform ios
```

**Where secrets live**

- **Expo public env** (`EXPO_PUBLIC_*`): Firebase client config, RevenueCat public SDK keys, mock Pro flag.
- **Firebase Functions secrets** (never in the app): `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `TOKEN_ENCRYPTION_KEY` via `./scripts/set-function-secrets.sh`.

Ship checklist: `./scripts/production-checklist.sh`  
Apple Sign-In: `./scripts/apple-signin-checklist.sh`  
RevenueCat mapping: [docs/revenuecat-setup.md](./docs/revenuecat-setup.md)  
Icon / logo prompt: [docs/icon-logo-prompt.md](./docs/icon-logo-prompt.md)

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

MVP product code + prod/dev build hygiene. Console steps (live Plaid, App Store IAP, privacy URL) remain before store submission — see the production checklist.
