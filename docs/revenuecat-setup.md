# RevenueCat setup plan — Tally

Agents cannot finish this in the dashboard: the RevenueCat MCP is unauthenticated in this environment, and store credentials live in App Store Connect / Play Console. Use this document to map the project by hand (or re-run with RevenueCat MCP logged in).

The SDK, entitlement id, and purchase screen are already in the app. What is missing is a complete dashboard → store → EAS → Functions mapping so Pro actually unlocks.

## Current app contract (do not rename)

| Piece | Value | Where |
|-------|--------|--------|
| Display name | Tally | `app.json` |
| iOS bundle ID | `com.calmmoney.app` | `app.json` → `expo.ios.bundleIdentifier` |
| Android package | `com.calmmoney.app` | `app.json` → `expo.android.package` |
| Entitlement | `premium` | `src/lib/purchases.ts` `ENTITLEMENT_ID` |
| Identify user | Firebase `uid` via `Purchases.logIn(uid)` | `src/providers/AuthProvider.tsx` |
| Purchase package | `$rc_monthly` (falls back to first package) | `app/pro.tsx` |
| Client keys | `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `_ANDROID_API_KEY` | `.env`, EAS env |
| Server secret | `REVENUECAT_SECRET_API_KEY` | Cloud Functions param (`functions/src/index.ts`) |
| Premium mirror | callable `syncPremiumStatus` | writes `users/{uid}.isPremium` |
| Existing RC project note | `proj0479c91e` | `docs/eas-env-revenuecat.txt` (confirm in dashboard) |

Free vs Pro (constitution): calendar + manual entry + current-year history stay free. Pro is bank sync, couple sharing, longer history.

## Why this is currently misconfigured

1. **EAS profiles did not set RevenueCat keys.** Builds only get keys if someone pasted them into Expo dashboard env. `eas.json` now forces `EXPO_PUBLIC_MOCK_PREMIUM` per profile; public SDK keys still must be added as EAS environment variables / secrets (below).
2. **Android Play app is a placeholder.** `docs/eas-env-revenuecat.txt` has `goog_REPLACE_AFTER_CREATING_PLAY_APP`.
3. **Functions cannot verify production purchases** until `REVENUECAT_SECRET_API_KEY` is a real `sk_…` secret API key. Without it, `syncPremiumStatus` only trusts the client claim when `PLAID_ENV=sandbox`.
4. **Store products / offering / paywall** may not exist or may not use lookup keys the SDK expects (`premium`, `$rc_monthly`, `$rc_annual`).
5. **Test Store vs App Store keys** must not leak into production binaries.

## Target catalog

Create in this order (RevenueCat dependencies). Weekly + annual, one entitlement — matches constitution and `pro.tsx`.

### 1. Project

- Name: **Tally**
- Confirm or create. If `proj0479c91e` is the right project, reuse it; otherwise create **Tally** and update this file.

### 2. Apps

| Store | Type | Identifier | Public SDK key prefix |
|-------|------|------------|------------------------|
| Test Store | `test_store` (always present) | n/a | `test_…` |
| iOS | `app_store` | `com.calmmoney.app` | `appl_…` |
| Android | `play_store` | `com.calmmoney.app` | `goog_…` |

Create the App Store / Play apps only after the matching store listing exists. Until then, development and preview stay on Test Store keys.

### 3. Products (RevenueCat + stores)

Create the same product ids in App Store Connect and Play Console, then in RevenueCat.

| Product id | Type | Duration | Store |
|------------|------|----------|-------|
| `tally_pro_monthly` | auto-renewing subscription | P1M | App Store + Play |
| `tally_pro_annual` | auto-renewing subscription | P1Y | App Store + Play |

Suggested pricing: match the developer’s other apps (weekly was mentioned in the constitution as an option — if you prefer weekly, add `tally_pro_weekly` / P1W and a `$rc_weekly` package; the SDK will still work because `pro.tsx` falls back to the first package).

App Store Connect: Paid Applications agreement, subscription group e.g. **Tally Pro**, localization, review screenshot.  
Play Console: subscriptions with base plans `monthly` / `annual`.

### 4. Entitlement

- Lookup key: **`premium`** (must match `ENTITLEMENT_ID`)
- Attach both products.

### 5. Offering

- Lookup key: **`default`** (current)
- Packages:
  - `$rc_monthly` → `tally_pro_monthly`
  - `$rc_annual` → `tally_pro_annual`

`purchasePackageById('$rc_monthly')` looks up `$rc_monthly` on `offerings.current`. If the offering is not marked current, the Pro screen shows “No packages available”.

### 6. Optional dashboard paywall

Not required for v1 (`app/pro.tsx` is a custom calm screen). If you later add `react-native-purchases-ui`, attach a paywall to the `default` offering in the dashboard.

## Keys and where they go

Never put the **secret** API key (`sk_…`) in the app or EAS public env.

| Key | Prefix | Lives in | Used by |
|-----|--------|----------|---------|
| Test Store public | `test_…` | Expo env: development + preview | `Purchases.configure` |
| iOS public | `appl_…` | Expo env: production | iOS release |
| Android public | `goog_…` | Expo env: production | Android release |
| Secret | `sk_…` | Firebase Functions param `REVENUECAT_SECRET_API_KEY` | `syncPremiumStatus` / `verifyRevenueCatPremium` |

### Expo / EAS

Dashboard → Project **calm-money** (`7900a92c-bc0c-4c28-a7cd-bf7c8c0e9329`) → Environment variables:

**development**

```
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=test_…
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=test_…
EXPO_PUBLIC_MOCK_PREMIUM=true
```

**preview**

```
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=test_…
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=test_…
EXPO_PUBLIC_MOCK_PREMIUM=false
```

**production** (EAS secrets / production env, not git)

```
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_…
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_…
EXPO_PUBLIC_MOCK_PREMIUM=false
```

`src/lib/purchases.ts` already refuses to configure when the key is missing or contains `YOUR_`. `mockPremiumAllowed()` requires both `__DEV__` and `EXPO_PUBLIC_MOCK_PREMIUM=true`, so preview/production stay fail-closed.

A previous cheat sheet in `docs/eas-env-revenuecat.txt` listed sample keys — treat those as stale until you copy fresh keys from **Project settings → API keys**. Rotate if they were committed.

### Firebase Functions

```bash
npx firebase-tools@latest functions:params:set REVENUECAT_SECRET_API_KEY=sk_… --project calm-money-app
npx firebase-tools@latest deploy --only functions --project calm-money-app
```

After this, `syncPremiumStatus` ignores the client `isPremium` claim and checks `GET https://api.revenuecat.com/v1/subscribers/{uid}` for entitlement `premium`.

## Store credentials (RevenueCat ← stores)

### iOS

1. App Store Connect → Users and Access → Integrations → In-App Purchase: generate a `.p8`, note Key ID + Issuer ID.
2. In RevenueCat iOS app settings, upload the In-App Purchase key (StoreKit 2).
3. Optional legacy: app-specific shared secret.

### Android

1. Google Cloud service account with Play access (View financial data).
2. JSON key → RevenueCat Play app settings.
3. Real-time developer notifications (Pub/Sub) so renewals/cancellations sync without opening the app.

## Identity

Already implemented: anonymous configure at launch, then `Purchases.logIn(firebaseUid)` after auth, `logOut` on sign-out.

When mapping in the dashboard, confirm sandbox purchases show up on the **Firebase uid**, not an anonymous `$RCAnonymousID`. If they land on anonymous, transfers were missed — check that `logIn` runs after `configure` and that configure is not skipped (missing key).

## Testing ladder

1. **Test Store** (`test_…` + development client): tap Upgrade → Test Store sheet → Successful Purchase → `premium` active → bank/sharing unlock. Dashboard Sandbox view should show the uid.
2. **iOS sandbox**: sandbox Apple ID, StoreKit products attached, `appl_…` key on a preview/dev client with mock Pro **off**.
3. **Play license tester**: internal track, `goog_…` key.
4. **Production**: real money; dashboard Production view.

See RevenueCat docs: [Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store.md), [Sandbox](https://www.revenuecat.com/docs/test-and-launch/sandbox.md).

## Checklist (execute in order)

- [ ] RevenueCat project Tally (reuse `proj0479c91e` if it is this app)
- [ ] Test Store enabled; copy `test_…` into Expo **development** + **preview** env
- [ ] Entitlement `premium`
- [ ] Products `tally_pro_monthly` / `tally_pro_annual` in RC **and** both stores
- [ ] Attach products to `premium`
- [ ] Offering `default` (current) with `$rc_monthly` and `$rc_annual`
- [ ] iOS app `com.calmmoney.app` + App Store IAP key → `appl_…` into Expo **production**
- [ ] Play app `com.calmmoney.app` + service account → `goog_…` into Expo **production**
- [ ] `REVENUECAT_SECRET_API_KEY=sk_…` set and functions redeployed
- [ ] Dev client: configure log line appears; offerings not empty; purchase + restore
- [ ] `users/{uid}.isPremium` mirrors after purchase (callable)
- [ ] Production binary has **no** `test_…` key and `EXPO_PUBLIC_MOCK_PREMIUM=false`

## When MCP is available

Log into the RevenueCat MCP, then:

1. `list-projects` — pick Tally / `proj0479c91e`
2. Create missing apps, products, entitlement, offering, packages in the order above
3. `list-app-public-api-keys` — paste into Expo env (do not commit production keys)
4. Leave store `.p8` / Play JSON upload to a human in the dashboard

Until that login exists, this file is the source of truth for the mapping.
