import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { BankAccount, BankConnection } from '@/types/models';

export async function fetchBankConnections(userId: string): Promise<BankConnection[]> {
  const q = query(collection(db, 'bankConnections'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BankConnection, 'id'>) }));
}

export async function fetchBankAccounts(householdId: string): Promise<BankAccount[]> {
  const q = query(collection(db, 'bankAccounts'), where('householdId', '==', householdId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BankAccount, 'id'>) }));
}

export function listenBankAccounts(
  householdId: string,
  onData: (accounts: BankAccount[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'bankAccounts'), where('householdId', '==', householdId));
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BankAccount, 'id'>) })));
  });
}

export function listenBankConnections(
  userId: string,
  onData: (connections: BankConnection[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'bankConnections'), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BankConnection, 'id'>) })));
  });
}

export async function setBankAccountHidden(accountId: string, isHidden: boolean) {
  const fn = httpsCallable(functions, 'setBankAccountHidden');
  await fn({ accountId, isHidden });
}
