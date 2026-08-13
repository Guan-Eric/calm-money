import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  setDoc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { categorizeTransaction, normalizeMerchantKey } from '@/lib/categorize';
import { firestoreDateKey } from '@/lib/localDate';
import type { Category, Transaction, MerchantRule, SharingPrefs } from '@/types/models';

function txnFromDoc(id: string, data: Omit<Transaction, 'id'>): Transaction {
  return {
    id,
    ...data,
    date: firestoreDateKey(data.date),
  };
}

export async function fetchCategories(householdId: string): Promise<Category[]> {
  const q = query(collection(db, 'categories'), where('householdId', '==', householdId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function listenTransactions(params: {
  householdId: string;
  uid: string;
  onData: (txns: Transaction[]) => void;
  onError?: (e: Error) => void;
  /** When false, only current calendar year is returned (free tier). */
  isPremium?: boolean;
}): Unsubscribe {
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;

  // Split queries so security rules never see partner-private docs in one result set
  const mineConstraints = [
    where('householdId', '==', params.householdId),
    where('createdBy', '==', params.uid),
    orderBy('date', 'desc'),
  ];
  const sharedConstraints = [
    where('householdId', '==', params.householdId),
    where('visibility', '==', 'household'),
    orderBy('date', 'desc'),
  ];
  if (!params.isPremium) {
    mineConstraints.splice(2, 0, where('date', '>=', yearStart));
    sharedConstraints.splice(2, 0, where('date', '>=', yearStart));
  }

  let mine: Transaction[] = [];
  let shared: Transaction[] = [];

  const emit = () => {
    const byId = new Map<string, Transaction>();
    for (const t of [...mine, ...shared]) byId.set(t.id, t);
    const merged = Array.from(byId.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
    params.onData(merged);
  };

  const unsubMine = onSnapshot(
    query(collection(db, 'transactions'), ...mineConstraints),
    (snap) => {
      mine = snap.docs.map((d) => txnFromDoc(d.id, d.data() as Omit<Transaction, 'id'>));
      emit();
    },
    (err) => params.onError?.(err as Error),
  );
  const unsubShared = onSnapshot(
    query(collection(db, 'transactions'), ...sharedConstraints),
    (snap) => {
      shared = snap.docs.map((d) => txnFromDoc(d.id, d.data() as Omit<Transaction, 'id'>));
      emit();
    },
    (err) => params.onError?.(err as Error),
  );

  return () => {
    unsubMine();
    unsubShared();
  };
}

export function filterVisibleTransactions(params: {
  txns: Transaction[];
  uid: string;
  mode: 'mine' | 'ours';
  partnerSharing: SharingPrefs | null;
  /** Bank account IDs marked hidden — excluded from calendar intensity / totals. */
  hiddenAccountIds?: Set<string>;
}): Transaction[] {
  const { txns, uid, mode, hiddenAccountIds } = params;
  void params.partnerSharing;
  const notHidden = (t: Transaction) => {
    if (!t.externalAccountId || !hiddenAccountIds?.size) return true;
    return !hiddenAccountIds.has(t.externalAccountId);
  };
  if (mode === 'mine') {
    return txns.filter((t) => t.createdBy === uid && notHidden(t));
  }
  // Rules only allow partner docs with visibility == 'household'
  return txns.filter((t) => {
    if (!notHidden(t)) return false;
    if (t.createdBy === uid) return true;
    return t.visibility === 'household';
  });
}

export async function getMerchantRule(
  userId: string,
  merchantKey: string,
): Promise<MerchantRule | null> {
  const q = query(
    collection(db, 'merchantRules'),
    where('userId', '==', userId),
    where('merchantKey', '==', merchantKey),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<MerchantRule, 'id'>) };
}

export async function suggestCategoryId(params: {
  userId: string;
  merchant: string;
  categories: Category[];
  providerCategoryPrimary?: string | null;
}): Promise<string> {
  const byKey = Object.fromEntries(params.categories.map((c) => [c.nameKey, c.id]));
  const key = normalizeMerchantKey(params.merchant);
  const rule = key ? await getMerchantRule(params.userId, key) : null;
  return categorizeTransaction({
    merchant: params.merchant,
    providerCategoryPrimary: params.providerCategoryPrimary,
    merchantRuleCategoryId: rule?.categoryId,
    categoriesByNameKey: byKey,
  });
}

export async function createManualTransaction(params: {
  householdId: string;
  uid: string;
  amountMinor: number;
  currency: string;
  date: string;
  merchant: string;
  categoryId: string;
  note?: string;
  shareTransactions: boolean;
}): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(collection(db, 'transactions'), {
    householdId: params.householdId,
    createdBy: params.uid,
    amountMinor: params.amountMinor,
    currency: params.currency,
    date: params.date,
    merchant: params.merchant,
    categoryId: params.categoryId,
    note: params.note ?? null,
    source: 'manual',
    provider: null,
    visibility: params.shareTransactions ? 'household' : 'private',
    pending: false,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateTransactionCategory(params: {
  transactionId: string;
  categoryId: string;
  userId: string;
  merchant: string;
  householdId: string;
}) {
  const now = Date.now();
  await updateDoc(doc(db, 'transactions', params.transactionId), {
    categoryId: params.categoryId,
    updatedAt: now,
  });
  const merchantKey = normalizeMerchantKey(params.merchant);
  if (!merchantKey) return;

  const existing = await getMerchantRule(params.userId, merchantKey);
  if (existing) {
    await updateDoc(doc(db, 'merchantRules', existing.id), {
      categoryId: params.categoryId,
      source: 'user_override',
      updatedAt: now,
    });
  } else {
    await addDoc(collection(db, 'merchantRules'), {
      userId: params.userId,
      householdId: params.householdId,
      merchantKey,
      categoryId: params.categoryId,
      source: 'user_override',
      updatedAt: now,
    });
  }
}

export async function deleteTransaction(id: string) {
  await deleteDoc(doc(db, 'transactions', id));
}

export async function getSharingPrefs(userId: string, householdId: string): Promise<SharingPrefs | null> {
  const id = `${userId}_${householdId}`;
  const snap = await getDoc(doc(db, 'sharingPrefs', id));
  if (!snap.exists()) return null;
  return snap.data() as SharingPrefs;
}

export async function setShareTransactions(params: {
  userId: string;
  householdId: string;
  share: boolean;
}) {
  const id = `${params.userId}_${params.householdId}`;
  await setDoc(
    doc(db, 'sharingPrefs', id),
    {
      id,
      userId: params.userId,
      householdId: params.householdId,
      shareTransactions: params.share,
      shareAccountIds: [],
    },
    { merge: true },
  );

  // Update visibility on user's private/household txns
  const q = query(
    collection(db, 'transactions'),
    where('householdId', '==', params.householdId),
    where('createdBy', '==', params.userId),
  );
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs.map((d) =>
      updateDoc(d.ref, {
        visibility: params.share ? 'household' : 'private',
        updatedAt: Date.now(),
      }),
    ),
  );
}
