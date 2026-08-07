import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { HouseholdInvite } from '@/types/models';

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

export async function leaveHousehold(_params: {
  uid: string;
  householdId: string;
}): Promise<string> {
  const fn = httpsCallable(functions, 'leaveHousehold');
  const res = await fn({});
  return (res.data as { householdId: string }).householdId;
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
