import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret, defineString } from 'firebase-functions/params';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';
import { categorizeTransaction, normalizeMerchantKey } from './categorize';
import { encryptAccessToken, decryptAccessToken, tokenEncryptionKey } from './crypto';

initializeApp();
const db = getFirestore();

const plaidClientId = defineSecret('PLAID_CLIENT_ID');
const plaidSecret = defineSecret('PLAID_SECRET');
const plaidEnv = defineSecret('PLAID_ENV');
/** Optional — set via `firebase functions:config` / params; empty = sandbox client-claim mode only */
const revenueCatSecretParam = defineString('REVENUECAT_SECRET_API_KEY', { default: '' });

const PLAID_SECRETS = [plaidClientId, plaidSecret, plaidEnv, tokenEncryptionKey];
const PREMIUM_SECRETS = [plaidEnv];

function plaidClient() {
  const env = (plaidEnv.value() || 'sandbox') as keyof typeof PlaidEnvironments;
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env] ?? PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': plaidClientId.value(),
          'PLAID-SECRET': plaidSecret.value(),
        },
      },
    }),
  );
}

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
  return uid;
}

function isSandboxPlaid(): boolean {
  try {
    return (plaidEnv.value() || 'sandbox') === 'sandbox';
  } catch {
    return true;
  }
}

async function verifyRevenueCatPremium(uid: string, secret: string): Promise<boolean> {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return false;
  const body = (await res.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date?: string | null }> };
  };
  const ent = body.subscriber?.entitlements?.premium;
  if (!ent) return false;
  if (!ent.expires_date) return true;
  return new Date(ent.expires_date).getTime() > Date.now();
}

async function requirePremium(uid: string) {
  const user = await db.collection('users').doc(uid).get();
  const data = user.data();
  if (data?.isPremium === true) return data;
  throw new HttpsError('permission-denied', 'Tally Pro required');
}

async function getUserHousehold(uid: string) {
  const user = await db.collection('users').doc(uid).get();
  if (!user.exists) throw new HttpsError('failed-precondition', 'User profile missing');
  const householdId = user.data()?.householdId as string;
  if (!householdId) throw new HttpsError('failed-precondition', 'Household missing');
  const hh = await db.collection('households').doc(householdId).get();
  if (!hh.exists) throw new HttpsError('failed-precondition', 'Household missing');
  const memberIds = (hh.data()?.memberIds as string[]) ?? [];
  if (!memberIds.includes(uid)) {
    throw new HttpsError(
      'failed-precondition',
      'Not a household member — repair membership or leave and rejoin',
    );
  }
  return { householdId, user: user.data()!, household: hh.data()!, memberIds };
}

async function categoryMap(householdId: string): Promise<Record<string, string>> {
  const snap = await db.collection('categories').where('householdId', '==', householdId).get();
  const map: Record<string, string> = {};
  snap.docs.forEach((d) => {
    map[d.data().nameKey as string] = d.id;
  });
  return map;
}

async function lookupMerchantRule(uid: string, merchantKey: string) {
  const snap = await db
    .collection('merchantRules')
    .where('userId', '==', uid)
    .where('merchantKey', '==', merchantKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data().categoryId as string;
}

async function sendExpoPush(token: string, title: string, body: string) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, sound: null }),
  });
}

function inviteDeepLink(code: string) {
  return `calmmoney://invite?code=${encodeURIComponent(code)}`;
}

const DEFAULT_CATEGORIES = [
  { nameKey: 'food', color: '#c4b5a5', icon: 'fork.knife', sortOrder: 0 },
  { nameKey: 'home', color: '#a8b5a0', icon: 'house', sortOrder: 1 },
  { nameKey: 'transport', color: '#9aafbf', icon: 'car', sortOrder: 2 },
  { nameKey: 'shopping', color: '#b8a9b8', icon: 'bag', sortOrder: 3 },
  { nameKey: 'health', color: '#a9b8b0', icon: 'heart', sortOrder: 4 },
  { nameKey: 'fun', color: '#c4b89a', icon: 'sparkles', sortOrder: 5 },
  { nameKey: 'bills', color: '#a3a8b0', icon: 'doc.text', sortOrder: 6 },
  { nameKey: 'subscriptions', color: '#b0a8b8', icon: 'repeat', sortOrder: 7 },
  { nameKey: 'other', color: '#b0aea8', icon: 'circle', sortOrder: 8 },
];

/** Move the user's bank + txn docs to a new household (leave / accept). */
async function rehomeUserFinancialData(uid: string, fromHouseholdId: string, toHouseholdId: string) {
  const connections = await db.collection('bankConnections').where('userId', '==', uid).get();
  const accounts = await db.collection('bankAccounts').where('ownerUserId', '==', uid).get();
  const txns = await db
    .collection('transactions')
    .where('householdId', '==', fromHouseholdId)
    .where('createdBy', '==', uid)
    .get();

  type Op = () => void;
  const ops: Op[] = [];
  let batch = db.batch();
  let count = 0;

  const enqueue = (fn: Op) => {
    ops.push(fn);
  };

  for (const d of connections.docs) {
    enqueue(() => batch.update(d.ref, { householdId: toHouseholdId }));
    const secretRef = db.collection('bankConnectionSecrets').doc(d.id);
    enqueue(() => batch.set(secretRef, { householdId: toHouseholdId }, { merge: true }));
  }
  for (const d of accounts.docs) {
    enqueue(() => batch.update(d.ref, { householdId: toHouseholdId }));
  }
  for (const d of txns.docs) {
    enqueue(() => batch.update(d.ref, { householdId: toHouseholdId }));
  }

  for (const op of ops) {
    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
    op();
    count += 1;
  }
  if (count > 0) await batch.commit();
}

/** Sync Pro flag. Production: verify via RevenueCat secret. Sandbox: allow client claim. */
export const syncPremiumStatus = onCall({ secrets: PREMIUM_SECRETS }, async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const claimed = Boolean(request.data?.isPremium);
  let allowed = false;

  let secret = '';
  try {
    secret = revenueCatSecretParam.value() || '';
  } catch {
    secret = '';
  }

  if (secret && !secret.startsWith('REPLACE')) {
    allowed = await verifyRevenueCatPremium(uid, secret);
  } else if (isSandboxPlaid()) {
    // Local / sandbox only — never trust client claim in production Plaid env
    allowed = claimed;
  } else {
    throw new HttpsError(
      'failed-precondition',
      'Set REVENUECAT_SECRET_API_KEY to sync Pro in production',
    );
  }

  await db.collection('users').doc(uid).set(
    {
      isPremium: allowed,
      premiumSyncedAt: Date.now(),
    },
    { merge: true },
  );
  return { isPremium: allowed };
});

export const createLinkToken = onCall({ secrets: PLAID_SECRETS }, async (request) => {
  const uid = requireAuth(request.auth?.uid);
  await requirePremium(uid);
  const { householdId } = await getUserHousehold(uid);
  const countryCodes = (request.data?.countryCodes as string[] | undefined) ?? ['US'];
  const client = plaidClient();
  const codes = countryCodes.map((c) => c as CountryCode);
  const response = await client.linkTokenCreate({
    user: { client_user_id: uid },
    client_name: 'Tally',
    products: [Products.Transactions],
    country_codes: codes.length ? codes : [CountryCode.Us],
    language: 'en',
  });
  return { linkToken: response.data.link_token, householdId };
});

export const exchangePublicToken = onCall({ secrets: PLAID_SECRETS }, async (request) => {
  const uid = requireAuth(request.auth?.uid);
  await requirePremium(uid);
  const { householdId } = await getUserHousehold(uid);
  const publicToken = request.data?.publicToken as string;
  if (!publicToken) throw new HttpsError('invalid-argument', 'publicToken required');

  const client = plaidClient();
  const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;
  const encrypted = encryptAccessToken(accessToken, tokenEncryptionKey.value());

  const accountsResp = await client.accountsGet({ access_token: accessToken });
  const accountIds: string[] = [];
  const batch = db.batch();

  for (const acct of accountsResp.data.accounts) {
    accountIds.push(acct.account_id);
    batch.set(db.collection('bankAccounts').doc(acct.account_id), {
      householdId,
      connectionId: itemId,
      provider: 'plaid',
      ownerUserId: uid,
      name: acct.name,
      mask: acct.mask ?? null,
      type: acct.type ?? null,
      subtype: acct.subtype ?? null,
      currency: acct.balances.iso_currency_code ?? 'USD',
      isHidden: false,
    });
  }

  batch.set(db.collection('bankConnections').doc(itemId), {
    householdId,
    userId: uid,
    provider: 'plaid',
    institutionName: request.data?.institutionName ?? 'Bank',
    institutionId: request.data?.institutionId ?? null,
    countryCode: request.data?.countryCode ?? 'US',
    status: 'active',
    lastSyncedAt: null,
    cursor: null,
    accountIds,
    errorMessage: null,
  });
  batch.set(db.collection('bankConnectionSecrets').doc(itemId), {
    accessTokenEncrypted: encrypted,
    userId: uid,
    householdId,
    encryptedAt: Date.now(),
  });

  await batch.commit();
  return { itemId, accountIds };
});

export const syncTransactions = onCall({ secrets: PLAID_SECRETS }, async (request) => {
  const uid = requireAuth(request.auth?.uid);
  await requirePremium(uid);
  const { householdId, user } = await getUserHousehold(uid);
  const client = plaidClient();
  const connections = await db
    .collection('bankConnections')
    .where('userId', '==', uid)
    .where('status', 'in', ['active', 'error'])
    .get();

  const cats = await categoryMap(householdId);
  const shareSnap = await db.collection('sharingPrefs').doc(`${uid}_${householdId}`).get();
  const share = shareSnap.data()?.shareTransactions === true;
  let count = 0;

  for (const connDoc of connections.docs) {
    const conn = connDoc.data();
    const secretSnap = await db.collection('bankConnectionSecrets').doc(connDoc.id).get();
    const raw = secretSnap.data()?.accessTokenEncrypted as string | undefined;
    if (!raw) continue;

    let accessToken: string;
    try {
      accessToken = decryptAccessToken(raw, tokenEncryptionKey.value());
    } catch {
      await connDoc.ref.update({ status: 'error', errorMessage: 'Could not read bank credentials' });
      continue;
    }

    let cursor = (conn.cursor as string | null) ?? undefined;
    let hasMore = true;

    try {
      while (hasMore) {
        const sync = await client.transactionsSync({ access_token: accessToken, cursor });
        const { added, modified, removed, next_cursor, has_more } = sync.data;

        for (const txn of [...added, ...modified]) {
          const merchant = txn.merchant_name || txn.name || 'Transaction';
          const merchantKey = normalizeMerchantKey(merchant);
          const ruleCat = await lookupMerchantRule(uid, merchantKey);
          const categoryId = categorizeTransaction({
            merchant,
            providerCategoryPrimary: txn.personal_finance_category?.primary,
            merchantRuleCategoryId: ruleCat,
            categoriesByNameKey: cats,
          });
          const amountMinor = Math.round(Math.abs(txn.amount) * 100);
          const id = `plaid_${txn.transaction_id}`;
          const ref = db.collection('transactions').doc(id);
          const existing = await ref.get();
          const base = {
            householdId,
            createdBy: uid,
            amountMinor,
            currency: txn.iso_currency_code ?? 'USD',
            date: txn.date,
            merchant,
            categoryId,
            note: existing.exists ? (existing.data()?.note ?? null) : null,
            source: 'bank' as const,
            provider: 'plaid',
            externalTxnId: txn.transaction_id,
            externalAccountId: txn.account_id,
            pending: txn.pending,
            updatedAt: Date.now(),
          };
          if (!existing.exists) {
            await ref.set({
              ...base,
              visibility: share ? 'household' : 'private',
              createdAt: Date.now(),
            });
          } else {
            // Preserve visibility + createdAt; keep user category overrides if set via merchant rule already applied
            const prevCat = existing.data()?.categoryId;
            await ref.set(
              {
                ...base,
                categoryId: prevCat || categoryId,
              },
              { merge: true },
            );
          }
          count += 1;
        }

        for (const r of removed) {
          await db
            .collection('transactions')
            .doc(`plaid_${r.transaction_id}`)
            .delete()
            .catch(() => undefined);
        }

        cursor = next_cursor;
        hasMore = has_more;
      }

      await connDoc.ref.update({
        cursor,
        lastSyncedAt: Date.now(),
        status: 'active',
        errorMessage: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed';
      await connDoc.ref.update({ status: 'error', errorMessage: msg });
    }
  }

  if (user.notificationPrefs?.syncComplete && user.expoPushToken) {
    await sendExpoPush(
      user.expoPushToken as string,
      'Bank updated',
      'Your accounts finished syncing.',
    );
  }

  return { count };
});

export const setBankAccountHidden = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const accountId = request.data?.accountId as string;
  const isHidden = Boolean(request.data?.isHidden);
  if (!accountId) throw new HttpsError('invalid-argument', 'accountId required');
  const ref = db.collection('bankAccounts').doc(accountId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.ownerUserId !== uid) {
    throw new HttpsError('permission-denied', 'Not your account');
  }
  await ref.update({ isHidden });
  return { ok: true };
});

export const createHouseholdInvite = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  await requirePremium(uid);
  const { householdId, memberIds } = await getUserHousehold(uid);
  if (memberIds.length >= 2) {
    throw new HttpsError('failed-precondition', 'Household is full');
  }

  // Revoke any prior pending invites so only one live code exists
  const prior = await db
    .collection('householdInvites')
    .where('householdId', '==', householdId)
    .where('createdBy', '==', uid)
    .where('status', '==', 'pending')
    .get();
  const revokeBatch = db.batch();
  prior.docs.forEach((d) => revokeBatch.update(d.ref, { status: 'revoked' }));
  if (!prior.empty) await revokeBatch.commit();

  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  const id = `inv_${Date.now().toString(36)}`;
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

  await db.collection('householdInvites').doc(id).set({
    householdId,
    createdBy: uid,
    code,
    status: 'pending',
    createdAt: now,
    expiresAt,
  });
  // Do not mirror code onto the household doc (readable by all members)

  return { id, code, expiresAt, deepLink: inviteDeepLink(code) };
});

export const revokeHouseholdInvite = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const { householdId } = await getUserHousehold(uid);
  const snap = await db
    .collection('householdInvites')
    .where('householdId', '==', householdId)
    .where('createdBy', '==', uid)
    .where('status', '==', 'pending')
    .get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { status: 'revoked' }));
  await batch.commit();
  return { revoked: snap.size };
});

export const acceptHouseholdInvite = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  await requirePremium(uid);
  const code = String(request.data?.code ?? '')
    .trim()
    .toUpperCase();
  if (!code) throw new HttpsError('invalid-argument', 'code required');

  const snap = await db
    .collection('householdInvites')
    .where('code', '==', code)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (snap.empty) throw new HttpsError('not-found', 'Invite not found');
  const inviteDoc = snap.docs[0];
  const invite = inviteDoc.data();
  if (invite.expiresAt < Date.now()) throw new HttpsError('failed-precondition', 'Invite expired');
  if (invite.createdBy === uid) throw new HttpsError('invalid-argument', 'Cannot accept own invite');

  const householdId = invite.householdId as string;
  const userRef = db.collection('users').doc(uid);
  const user = await userRef.get();
  const oldHouseholdId = user.data()?.householdId as string | undefined;

  await db.runTransaction(async (tx) => {
    const hhRef = db.collection('households').doc(householdId);
    const hh = await tx.get(hhRef);
    if (!hh.exists) throw new HttpsError('not-found', 'Household missing');
    const memberIds = (hh.data()?.memberIds as string[]) ?? [];
    if (memberIds.includes(uid)) {
      tx.update(inviteDoc.ref, { status: 'accepted' });
      return;
    }
    if (memberIds.length >= 2) throw new HttpsError('failed-precondition', 'Household is full');

    tx.update(hhRef, {
      memberIds: FieldValue.arrayUnion(uid),
      inviteCode: null,
      inviteExpiresAt: null,
    });
    tx.update(userRef, { householdId });
    tx.update(inviteDoc.ref, { status: 'accepted' });
    tx.set(
      db.collection('sharingPrefs').doc(`${uid}_${householdId}`),
      {
        id: `${uid}_${householdId}`,
        householdId,
        userId: uid,
        shareTransactions: false,
        shareAccountIds: [],
      },
      { merge: true },
    );

    if (oldHouseholdId && oldHouseholdId !== householdId) {
      const oldRef = db.collection('households').doc(oldHouseholdId);
      const oldHh = await tx.get(oldRef);
      tx.update(oldRef, { memberIds: FieldValue.arrayRemove(uid) });
      const oldMembers = (oldHh.data()?.memberIds as string[]) ?? [];
      if (oldMembers.length <= 1) {
        // Categories cleaned after transaction (reads outside tx)
      }
    }
  });

  if (oldHouseholdId && oldHouseholdId !== householdId) {
    await rehomeUserFinancialData(uid, oldHouseholdId, householdId);
    const oldHh = await db.collection('households').doc(oldHouseholdId).get();
    const oldMembers = (oldHh.data()?.memberIds as string[]) ?? [];
    if (oldMembers.length === 0) {
      const oldCats = await db.collection('categories').where('householdId', '==', oldHouseholdId).get();
      const b = db.batch();
      oldCats.docs.forEach((d) => b.delete(d.ref));
      if (!oldCats.empty) await b.commit();
    }
  }

  const inviter = await db.collection('users').doc(invite.createdBy as string).get();
  const inviterData = inviter.data();
  if (inviterData?.notificationPrefs?.partnerInvite && inviterData.expoPushToken) {
    await sendExpoPush(
      inviterData.expoPushToken as string,
      'Partner joined',
      'You’re sharing a household now.',
    );
  }

  return { householdId };
});

export const leaveHousehold = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const { householdId, household } = await getUserHousehold(uid);
  const newId = `hh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const countryCode = (household.countryCode as string) ?? 'US';
  const defaultCurrency = (household.defaultCurrency as string) ?? 'USD';

  const batch = db.batch();
  batch.set(db.collection('households').doc(newId), {
    memberIds: [uid],
    createdAt: now,
    countryCode,
    defaultCurrency,
  });
  batch.update(db.collection('households').doc(householdId), {
    memberIds: FieldValue.arrayRemove(uid),
  });
  batch.update(db.collection('users').doc(uid), { householdId: newId });
  batch.set(db.collection('sharingPrefs').doc(`${uid}_${newId}`), {
    id: `${uid}_${newId}`,
    householdId: newId,
    userId: uid,
    shareTransactions: false,
    shareAccountIds: [],
  });
  for (const cat of DEFAULT_CATEGORIES) {
    const ref = db.collection('categories').doc();
    batch.set(ref, { householdId: newId, ...cat });
  }
  await batch.commit();

  await rehomeUserFinancialData(uid, householdId, newId);

  return { householdId: newId };
});

export const weeklyDigest = onSchedule(
  { schedule: 'every monday 09:00', timeZone: 'America/New_York' },
  async () => {
    const users = await db.collection('users').where('notificationPrefs.weeklyDigest', '==', true).get();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const start = weekAgo.toISOString().slice(0, 10);

    for (const u of users.docs) {
      const data = u.data();
      if (!data.expoPushToken || !data.householdId) continue;

      const txns = await db
        .collection('transactions')
        .where('householdId', '==', data.householdId)
        .where('createdBy', '==', u.id)
        .where('date', '>=', start)
        .get();

      let totalMinor = 0;
      let currency = 'USD';
      txns.docs.forEach((d) => {
        const t = d.data();
        totalMinor += t.amountMinor as number;
        currency = (t.currency as string) || currency;
      });
      const amount = (totalMinor / 100).toLocaleString('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      });

      await sendExpoPush(
        data.expoPushToken as string,
        'Your week',
        `Last week’s spending was about ${amount}. Open Tally when you’re ready.`,
      );
    }
  },
);
