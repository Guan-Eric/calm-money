import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_CATEGORIES } from '@/types/models';

type DemoTxn = {
  daysAgo: number;
  merchant: string;
  amount: number;
  cat: string;
  source: 'manual' | 'bank';
};

const DEMO_TXNS: DemoTxn[] = [
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
  { daysAgo: 9, merchant: "Trader Joe's", amount: 41.35, cat: 'food', source: 'bank' },
  { daysAgo: 11, merchant: 'Shell Gas', amount: 45.0, cat: 'transport', source: 'bank' },
  { daysAgo: 12, merchant: 'Netflix', amount: 15.49, cat: 'subscriptions', source: 'bank' },
  { daysAgo: 14, merchant: 'IKEA', amount: 62.0, cat: 'home', source: 'manual' },
  { daysAgo: 16, merchant: 'Bookstore', amount: 24.0, cat: 'fun', source: 'manual' },
  { daysAgo: 18, merchant: 'Target', amount: 37.8, cat: 'shopping', source: 'bank' },
  { daysAgo: 20, merchant: 'Dentist', amount: 120.0, cat: 'health', source: 'manual' },
  { daysAgo: 22, merchant: 'Farmers Market', amount: 33.5, cat: 'food', source: 'manual' },
  { daysAgo: 25, merchant: 'Internet', amount: 70.0, cat: 'bills', source: 'bank' },
  { daysAgo: 28, merchant: 'Coffee Roasters', amount: 14.0, cat: 'food', source: 'bank' },
  { daysAgo: 45, merchant: 'Airport Taxi', amount: 52.0, cat: 'transport', source: 'manual' },
  { daysAgo: 60, merchant: 'Hardware Store', amount: 29.99, cat: 'home', source: 'bank' },
  { daysAgo: 75, merchant: 'Sushi Place', amount: 68.0, cat: 'food', source: 'manual' },
  { daysAgo: 90, merchant: 'Gym', amount: 45.0, cat: 'health', source: 'bank' },
];

function ymdDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Ensure a household the signed-in user can actually write into. */
async function ensureWritableHousehold(params: {
  uid: string;
  householdId: string;
  currency: string;
  countryCode: string;
}): Promise<string> {
  const { uid, householdId, currency, countryCode } = params;
  try {
    const ref = doc(db, 'households', householdId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const members = (snap.data().memberIds as string[]) ?? [];
      if (members.includes(uid)) return householdId;
      // Profile points here but membership is missing — repair in place
      await setDoc(ref, { memberIds: [...members, uid] }, { merge: true });
      return householdId;
    }
  } catch {
    // Missing permission or missing doc — create a fresh household below.
  }

  const newId = `hh_${uid.slice(0, 8)}_${Date.now().toString(36)}`;
  await setDoc(doc(db, 'households', newId), {
    memberIds: [uid],
    createdAt: Date.now(),
    countryCode,
    defaultCurrency: currency,
  });
  await setDoc(doc(db, 'users', uid), { householdId: newId }, { merge: true });
  return newId;
}

async function ensureCategories(householdId: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const snap = await getDocs(
      query(collection(db, 'categories'), where('householdId', '==', householdId)),
    );
    snap.docs.forEach((d) => {
      map[d.data().nameKey as string] = d.id;
    });
  } catch {
    // Fall through and create.
  }

  if (Object.keys(map).length >= DEFAULT_CATEGORIES.length) return map;

  const batch = writeBatch(db);
  for (const cat of DEFAULT_CATEGORIES) {
    if (map[cat.nameKey]) continue;
    // Deterministic ids so re-seed is idempotent and doesn't need list permission
    const ref = doc(db, 'categories', `demo_cat_${householdId}_${cat.nameKey}`);
    batch.set(ref, { householdId, ...cat }, { merge: true });
    map[cat.nameKey] = ref.id;
  }
  await batch.commit();
  return map;
}

/** Client-side seed for the signed-in user (uses their Firestore permissions). */
export async function seedDemoData(params: {
  uid: string;
  householdId: string;
  currency: string;
  countryCode: string;
}): Promise<{ transactionCount: number; householdId: string }> {
  const { uid, currency, countryCode } = params;
  const householdId = await ensureWritableHousehold(params);

  const catsByKey = await ensureCategories(householdId);

  const prefId = `${uid}_${householdId}`;
  await setDoc(
    doc(db, 'sharingPrefs', prefId),
    {
      id: prefId,
      householdId,
      userId: uid,
      shareTransactions: false,
      shareAccountIds: [],
      displayNameInHousehold: 'You',
    },
    { merge: true },
  );

  const connectionId = `demo_plaid_${uid.slice(0, 8)}`;
  const checkingId = `demo_acct_checking_${uid.slice(0, 6)}`;
  const savingsId = `demo_acct_savings_${uid.slice(0, 6)}`;
  try {
    await setDoc(
      doc(db, 'bankConnections', connectionId),
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
    await setDoc(
      doc(db, 'bankAccounts', checkingId),
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
    await setDoc(
      doc(db, 'bankAccounts', savingsId),
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
  } catch {
    // Bank seed is optional if rules lag; transactions still load.
  }

  const now = Date.now();
  const batch = writeBatch(db);
  let n = 0;
  for (const t of DEMO_TXNS) {
    const categoryId = catsByKey[t.cat] || catsByKey.other;
    if (!categoryId) continue;
    const id = `demo_${uid.slice(0, 6)}_${t.daysAgo}_${n}`;
    const isBank = t.source === 'bank';
    batch.set(doc(db, 'transactions', id), {
      householdId,
      createdBy: uid,
      amountMinor: Math.round(t.amount * 100),
      currency,
      date: ymdDaysAgo(t.daysAgo),
      merchant: t.merchant,
      categoryId,
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

  return { transactionCount: n, householdId };
}
