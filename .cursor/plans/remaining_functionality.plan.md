---
name: Remaining functionality
overview: Work left after Plan B scaffold and Wealthsimple-inspired UI pass — ops to ship live bank sync, product gaps from the MVP plan, and optional polish beyond MVP.
todos:
  - id: ops-blaze-functions
    content: Upgrade Firebase to Blaze; deploy Functions; set Plaid secrets
    status: completed
  - id: ops-apple-auth
    content: Enable Apple provider in Firebase + Apple Developer Services ID
    status: completed
  - id: ops-dev-client
    content: EAS/dev client build for Plaid Link + RevenueCat purchases
    status: completed
  - id: pro-history-gate
    content: Enforce free-tier current-year history on calendar queries
    status: completed
  - id: invite-revoke-email
    content: Invite revoke UI + optional email/deep-link invite
    status: completed
  - id: bank-accounts-ui
    content: List/hide connected accounts; reconnect on Item error
    status: completed
  - id: token-encryption
    content: Encrypt Plaid access tokens at rest (not plaintext secrets docs)
    status: completed
  - id: digest-content
    content: Weekly digest with real week totals (still calm copy)
    status: completed
  - id: sharing-hardening
    content: Server-side Pro check on accept; tighten invite rules; leave/merge edge cases
    status: completed
  - id: polish-date-picker
    content: Native date picker on Add; optional category spend chart
    status: completed
isProject: false
---

# Remaining functionality plan

Scaffold + Wealthsimple-style UI are in place. This plan covers what is still needed to **ship** and what is still **missing vs Plan B**, plus optional next polish.

## Already done (context)

- Expo + Uniwind app, auth (email + Apple code), calendar Spend view, manual add, light categorization, couple sharing UI, Plaid Functions code, calm notification prefs, RevenueCat Test Store keys, Firestore rules/indexes, Wealthsimple-inspired visual pass (paper neutrals, olive, hero amounts, activity rows, pill CTAs).

## Phase A — Ops unblockers (required for real bank/IAP)

1. **Firebase Blaze** — upgrade `calm-money-app`, then deploy Functions.
2. **Plaid secrets** — `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox` via `firebase functions:secrets:set`.
3. **Apple Sign-In console** — enable Apple in Firebase Auth; Apple Developer Services ID / key / return URLs.
4. **Dev client / EAS** — replace placeholder `eas.projectId`; `npx expo run:ios` (or EAS) so Plaid Link + Purchases work (not Expo Go).
5. **Store apps later** — when ASC/Play exist, add RevenueCat `app_store` / `play_store` apps and swap `appl_` / `goog_` keys.

## Phase B — Plan B gaps still open in product code

| Gap | Why it matters | Approach |
|-----|----------------|----------|
| **Pro history gate** | Constitution / plan: free = current year only | Filter listen/queries by year unless `premium` |
| **Invite revoke** | Status exists; no UI | Settings Sharing → revoke pending invite |
| **Email / deep link invite** | Code-only today | Optional CF send + `calmmoney://invite?code=` |
| **Bank accounts UI** | Accounts written on sync; never shown | List institutions/accounts; hide; last synced; Sync button |
| **Token encryption** | Access token stored plaintext in secrets collection | Encrypt with Cloud KMS or Functions-managed key before write |
| **Weekly digest content** | Push is static copy | Aggregate last 7 days total in CF; calm factual sentence |
| **Accept Pro server-side** | Client-only gate | CF checks RevenueCat or mirrored entitlement claim |
| **Invite security rules** | Broad signed-in read/update | Restrict read to creator / code lookup via CF only |
| **Leave household** | Orphan HH; categories stay behind | Document or migrate solo categories on leave |
| **Categorize drift** | Client vs Functions heuristic lists differ | Shared package or single source file |
| **Partner display name** | On model; not editable | Small field on Sharing screen |

## Phase C — Optional polish (Wealthsimple-adjacent, not Plan B)

- Native **date picker** on Add
- Dedicated **Activity** feed tab (all txns, search)
- Soft **category breakdown** for the month (bar/list, no alarm colors)
- Onboarding empty-state narrative
- Account reconnect when Plaid Item errors

Out of scope unless revisited: FX conversion, TrueLayer, full category ML, Google Sign-In, anxiety pushes, households >2.

## Suggested order

1. Phase A (Blaze → secrets → deploy → dev client)  
2. Pro history gate + bank accounts UI  
3. Sharing hardening + revoke  
4. Digest content + token encryption  
5. Phase C polish as bandwidth allows  

## Verify when each phase is done

- Sandbox Plaid link → txns on Spend calendar  
- Free user cannot scroll multi-year history  
- Pro purchase / Test Store unlocks bank + sharing  
- Invite revoke works; partner still private until opt-in  
- Digest push includes a real number without shame language  
