import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  arrayRemove,
  getDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { DEFAULT_CATEGORIES, type HouseholdInvite } from '@/types/models';

export async function createInvite(params: {
  householdId: string;
  createdBy: string;
}): Promise<HouseholdInvite & { deepLink?: string }> {
  const fn = httpsCallable(functions, 'createHouseholdInvite');
  const res = await fn({});
  const data = res.data as { id: string; code: string; expiresAt: number; deepLink: string };
  return {
    id: data.id,
    householdId: params.householdId,
    createdBy: params.createdBy,
    code: data.code,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: data.expiresAt,
    deepLink: data.deepLink,
  };
}

export async function revokeInvite(): Promise<number> {
  const fn = httpsCallable(functions, 'revokeHouseholdInvite');
  const res = await fn({});
  return (res.data as { revoked: number }).revoked;
}

export async function acceptInvite(params: {
  code: string;
  uid: string;
  currentHouseholdId: string;
}): Promise<string> {
  const fn = httpsCallable(functions, 'acceptHouseholdInvite');
  const res = await fn({ code: params.code });
  return (res.data as { householdId: string }).householdId;
}

export async function leaveHousehold(params: {
  uid: string;
  householdId: string;
}): Promise<string> {
  try {
    const fn = httpsCallable(functions, 'leaveHousehold');
    const res = await fn({});
    return (res.data as { householdId: string }).householdId;
  } catch {
    const newId = `hh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const old = await getDoc(doc(db, 'households', params.householdId));
    const countryCode = (old.data()?.countryCode as string) ?? 'US';
    const defaultCurrency = (old.data()?.defaultCurrency as string) ?? 'USD';
    const batch = writeBatch(db);
    batch.set(doc(db, 'households', newId), {
      memberIds: [params.uid],
      createdAt: now,
      countryCode,
      defaultCurrency,
    });
    batch.update(doc(db, 'households', params.householdId), {
      memberIds: arrayRemove(params.uid),
    });
    batch.update(doc(db, 'users', params.uid), { householdId: newId });
    batch.set(doc(db, 'sharingPrefs', `${params.uid}_${newId}`), {
      id: `${params.uid}_${newId}`,
      householdId: newId,
      userId: params.uid,
      shareTransactions: false,
      shareAccountIds: [],
    });
    for (const cat of DEFAULT_CATEGORIES) {
      const ref = doc(collection(db, 'categories'));
      batch.set(ref, { householdId: newId, ...cat });
    }
    await batch.commit();
    return newId;
  }
}

export async function getPendingInviteForHousehold(householdId: string, createdBy: string) {
  const q = query(
    collection(db, 'householdInvites'),
    where('householdId', '==', householdId),
    where('createdBy', '==', createdBy),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<HouseholdInvite, 'id'>) };
}
