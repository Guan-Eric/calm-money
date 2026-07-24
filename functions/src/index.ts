import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
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

const PLAID_SECRETS = [plaidClientId, plaidSecret, plaidEnv, tokenEncryptionKey];

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

async function requirePremium(uid: string) {
  const user = await db.collection('users').doc(uid).get();
  const data = user.data();
  if (data?.isPremium === true) return data;
  // Allow short grace if premiumSyncedAt is recent and flag missing during race
  throw new HttpsError('permission-denied', 'Calm Money Pro required');
}

async function getUserHousehold(uid: string) {
  const user = await db.collection('users').doc(uid).get();
  if (!user.exists) throw new HttpsError('failed-precondition', 'User profile missing');
  const householdId = user.data()?.householdId as string;
  const hh = await db.collection('households').doc(householdId).get();
  if (!hh.exists) throw new HttpsError('failed-precondition', 'Household missing');
  return { householdId, user: user.data()!, household: hh.data()! };
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

export const createLinkToken = onCall({ secrets: PLAID_SECRETS }, async (request) => {
  const uid = requireAuth(request.auth?.uid);
  await requirePremium(uid);
  const { householdId } = await getUserHousehold(uid);
  const countryCodes = (request.data?.countryCodes as string[] | undefined) ?? ['US'];
  const client = plaidClient();
  const codes = countryCodes.map((c) => c as CountryCode);
  const response = await client.linkTokenCreate({
    user: { client_user_id: uid },
    client_name: 'Calm Money',
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
          await db.collection('transactions').doc(id).set(
            {
              householdId,
              createdBy: uid,
              amountMinor,
              currency: txn.iso_currency_code ?? 'USD',
              date: txn.date,
              merchant,
              categoryId,
              note: null,
              source: 'bank',
              provider: 'plaid',
              externalTxnId: txn.transaction_id,
              externalAccountId: txn.account_id,
              pending: txn.pending,
              visibility: share ? 'household' : 'private',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            { merge: true },
          );
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
  const { householdId } = await getUserHousehold(uid);
  const hh = await db.collection('households').doc(householdId).get();
  if ((hh.data()?.memberIds as string[])?.length >= 2) {
    throw new HttpsError('failed-precondition', 'Household is full');
  }

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
  await db.collection('households').doc(householdId).update({
    inviteCode: code,
    inviteExpiresAt: expiresAt,
  });

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
  batch.update(db.collection('households').doc(householdId), {
    inviteCode: null,
    inviteExpiresAt: null,
  });
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
  const hhRef = db.collection('households').doc(householdId);
  const hh = await hhRef.get();
  if (!hh.exists) throw new HttpsError('not-found', 'Household missing');
  const memberIds = (hh.data()?.memberIds as string[]) ?? [];
  if (memberIds.length >= 2) throw new HttpsError('failed-precondition', 'Household is full');

  const userRef = db.collection('users').doc(uid);
  const user = await userRef.get();
  const oldHouseholdId = user.data()?.householdId as string | undefined;

  const batch = db.batch();
  batch.update(hhRef, {
    memberIds: FieldValue.arrayUnion(uid),
    inviteCode: null,
    inviteExpiresAt: null,
  });
  batch.update(userRef, { householdId });
  batch.update(inviteDoc.ref, { status: 'accepted' });
  batch.set(
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
    const oldHh = await db.collection('households').doc(oldHouseholdId).get();
    const oldMembers = (oldHh.data()?.memberIds as string[]) ?? [];
    batch.update(db.collection('households').doc(oldHouseholdId), {
      memberIds: FieldValue.arrayRemove(uid),
    });
    // Solo orphan: remove leftover categories so they don't linger without an owner
    if (oldMembers.length <= 1) {
      const oldCats = await db.collection('categories').where('householdId', '==', oldHouseholdId).get();
      oldCats.docs.forEach((d) => batch.delete(d.ref));
    }
  }
  await batch.commit();

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

  const DEFAULTS = [
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
  for (const cat of DEFAULTS) {
    const ref = db.collection('categories').doc();
    batch.set(ref, { householdId: newId, ...cat });
  }
  await batch.commit();
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
        `Last week’s spending was about ${amount}. Open Calm Money when you’re ready.`,
      );
    }
  },
);
