#!/usr/bin/env node
/**
 * Seed demo spending data for an existing Calm Money user.
 *
 * Usage:
 *   node scripts/seed-demo-data.mjs --email=you@example.com
 *   node scripts/seed-demo-data.mjs --uid=FIREBASE_UID
 *   node scripts/seed-demo-data.mjs --email=you@example.com --premium
 *
 * Requires Firebase Admin credentials (firebase login / ADC).
 */
const admin = require(require('path').join(__dirname, '../functions/node_modules/firebase-admin'));

const PROJECT = process.env.FIREBASE_PROJECT || 'calm-money-app';

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

const DEMO_TXNS = [
  { daysAgo: 0, merchant: 'Blue Bottle', amount: 6.5, cat: 'food', source: 'manual' },
  { daysAgo: 0, merchant: 'Transit', amount: 2.9, cat: 'transport', source: 'bank' },
  { daysAgo: 1, merchant: 'Whole Foods', amount: 54.2, cat: 'food', source: 'bank' },
  { daysAgo: 2, merchant: 'Spotify', amount: 11.99, cat: 'subscriptions', source: 'bank' },
  { daysAgo: 3, merchant: 'Corner Cafe', amount: 8.75, cat: 'food', source: 'manual' },
  { daysAgo: 4, merchant: 'Uber', amount: 18.4, cat: 'transport', source: 'bank' },
  { daysAgo: 5, merchant: 'Pharmacy', amount: 22.0, cat: 'health', source: 'manual' },
  { daysAgo: 6, merchant: 'Uniqlo', amount: 49.0, cat: 'shopping', source: 'bank' },
  { daysAgo: 7, merchant: 'Electric Co', amount: 86.0, cat: 'bills', source: 'bank' },
  { daysAgo: 8, merchant: 'Cinema', amount: 28.0, cat: 'fun', source: 'manual' },
  { daysAgo: 9, merchant: 'Trader Joe\'s', amount: 41.35, cat: 'food', source: 'bank' },
  { daysAgo: 11, merchant: 'Shell Gas', amount: 45.0, cat: 'transport', source: 'bank' },
  { daysAgo: 12, merchant: 'Netflix', amount: 15.49, cat: 'subscriptions', source: 'bank' },
  { daysAgo: 14, merchant: 'IKEA', amount: 62.0, cat: 'home', source: 'manual' },
  { daysAgo: 16, merchant: 'Bookstore', amount: 24.0, cat: 'fun', source: 'manual' },
  { daysAgo: 18, merchant: 'Target', amount: 37.8, cat: 'shopping', source: 'bank' },
  { daysAgo: 20, merchant: 'Dentist', amount: 120.0, cat: 'health', source: 'manual' },
  { daysAgo: 22, merchant: 'Farmers Market', amount: 33.5, cat: 'food', source: 'manual' },
  { daysAgo: 25, merchant: 'Internet', amount: 70.0, cat: 'bills', source: 'bank' },
  { daysAgo: 28, merchant: 'Coffee Roasters', amount: 14.0, cat: 'food', source: 'bank' },
  // Earlier this year (still free-tier visible)
  { daysAgo: 45, merchant: 'Airport Taxi', amount: 52.0, cat: 'transport', source: 'manual' },
  { daysAgo: 60, merchant: 'Hardware Store', amount: 29.99, cat: 'home', source: 'bank' },
  { daysAgo: 75, merchant: 'Sushi Place', amount: 68.0, cat: 'food', source: 'manual' },
  { daysAgo: 90, merchant: 'Gym', amount: 45.0, cat: 'health', source: 'bank' },
];

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function daysAgoDate(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const email = arg('email');
  const uidArg = arg('uid');
  const wantPremium = hasFlag('premium');

  if (!email && !uidArg) {
    console.error('Pass --email=you@example.com or --uid=...');
    process.exit(1);
  }

  admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();
  const auth = admin.auth();

  let userRecord;
  if (uidArg) {
    userRecord = await auth.getUser(uidArg);
  } else {
    userRecord = await auth.getUserByEmail(email);
  }
  const uid = userRecord.uid;
  console.log(`Seeding for ${userRecord.email || uid} (${uid})`);

  let userSnap = await db.collection('users').doc(uid).get();
  let householdId;
  let currency = 'USD';
  let countryCode = 'US';

  if (!userSnap.exists) {
    householdId = `hh_demo_${uid.slice(0, 8)}`;
    const now = Date.now();
    await db.collection('households').doc(householdId).set({
      memberIds: [uid],
      createdAt: now,
      countryCode,
      defaultCurrency: currency,
    });
    await db.collection('users').doc(uid).set({
      email: userRecord.email || null,
      displayName: userRecord.displayName || 'Demo',
      householdId,
      locale: 'en-US',
      expoPushToken: null,
      isPremium: wantPremium,
      premiumSyncedAt: wantPremium ? now : null,
      notificationPrefs: {
        syncComplete: true,
        weeklyDigest: false,
        partnerInvite: true,
      },
      createdAt: now,
    });
    console.log(`Created missing user + household ${householdId}`);
  } else {
    const data = userSnap.data();
    householdId = data.householdId;
    if (wantPremium) {
      await userSnap.ref.update({ isPremium: true, premiumSyncedAt: Date.now() });
    }
    const hh = await db.collection('households').doc(householdId).get();
    if (hh.exists) {
      currency = hh.data().defaultCurrency || currency;
      countryCode = hh.data().countryCode || countryCode;
    }
  }

  // Categories
  const catSnap = await db.collection('categories').where('householdId', '==', householdId).get();
  const catsByKey = {};
  if (catSnap.empty) {
    const batch = db.batch();
    for (const cat of DEFAULT_CATEGORIES) {
      const ref = db.collection('categories').doc();
      batch.set(ref, { householdId, ...cat });
      catsByKey[cat.nameKey] = ref.id;
    }
    await batch.commit();
    console.log(`Created ${DEFAULT_CATEGORIES.length} categories`);
  } else {
    catSnap.docs.forEach((d) => {
      catsByKey[d.data().nameKey] = d.id;
    });
    console.log(`Using ${catSnap.size} existing categories`);
  }

  // Sharing prefs
  const prefId = `${uid}_${householdId}`;
  await db
    .collection('sharingPrefs')
    .doc(prefId)
    .set(
      {
        id: prefId,
        householdId,
        userId: uid,
        shareTransactions: false,
        shareAccountIds: [],
        displayNameInHousehold: userRecord.displayName || 'You',
      },
      { merge: true },
    );

  // Fake bank connection + accounts (UI testing; no real Plaid token)
  const connectionId = `demo_plaid_${uid.slice(0, 8)}`;
  const checkingId = `demo_acct_checking_${uid.slice(0, 6)}`;
  const savingsId = `demo_acct_savings_${uid.slice(0, 6)}`;
  await db
    .collection('bankConnections')
    .doc(connectionId)
    .set(
      {
        householdId,
        userId: uid,
        provider: 'plaid',
        institutionName: 'Demo First Bank',
        institutionId: 'ins_demo',
        countryCode,
        status: 'active',
        lastSyncedAt: Date.now(),
        accountIds: [checkingId, savingsId],
        errorMessage: null,
      },
      { merge: true },
    );
  await db
    .collection('bankAccounts')
    .doc(checkingId)
    .set(
      {
        householdId,
        connectionId,
        provider: 'plaid',
        ownerUserId: uid,
        name: 'Checking …4521',
        mask: '4521',
        type: 'depository',
        subtype: 'checking',
        currency,
        isHidden: false,
      },
      { merge: true },
    );
  await db
    .collection('bankAccounts')
    .doc(savingsId)
    .set(
      {
        householdId,
        connectionId,
        provider: 'plaid',
        ownerUserId: uid,
        name: 'Savings …8890',
        mask: '8890',
        type: 'depository',
        subtype: 'savings',
        currency,
        isHidden: false,
      },
      { merge: true },
    );

  // Clear previous demo txns for this user (ids start with demo_)
  const existing = await db
    .collection('transactions')
    .where('householdId', '==', householdId)
    .where('createdBy', '==', uid)
    .get();
  const toDelete = existing.docs.filter((d) => d.id.startsWith('demo_'));
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db.batch();
    toDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  if (toDelete.length) console.log(`Removed ${toDelete.length} old demo transactions`);

  const now = Date.now();
  const batch = db.batch();
  let n = 0;
  for (const t of DEMO_TXNS) {
    const catId = catsByKey[t.cat] || catsByKey.other;
    if (!catId) continue;
    const date = ymd(daysAgoDate(t.daysAgo));
    const id = `demo_${uid.slice(0, 6)}_${t.daysAgo}_${n}`;
    const isBank = t.source === 'bank';
    batch.set(db.collection('transactions').doc(id), {
      householdId,
      createdBy: uid,
      amountMinor: Math.round(t.amount * 100),
      currency,
      date,
      merchant: t.merchant,
      categoryId: catId,
      note: isBank ? null : 'Demo entry',
      source: t.source,
      provider: isBank ? 'plaid' : null,
      externalTxnId: isBank ? `demo_txn_${n}` : null,
      externalAccountId: isBank ? checkingId : null,
      pending: false,
      visibility: 'private',
      createdAt: now - t.daysAgo * 86400000,
      updatedAt: now,
    });
    n += 1;
  }
  await batch.commit();

  console.log(`Wrote ${n} demo transactions for household ${householdId}`);
  console.log(wantPremium || (userSnap.exists && userSnap.data()?.isPremium) ? 'Pro flag: on' : 'Pro flag: unchanged (pass --premium to enable)');
  console.log('Open Spend calendar to see the data.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
