import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { usePremium } from '@/providers/PremiumProvider';
import {
  fetchCategories,
  listenTransactions,
  filterVisibleTransactions,
  getSharingPrefs,
  createManualTransaction,
} from '@/lib/transactions';
import { listenBankAccounts } from '@/lib/bank';
import { syncPlaidTransactions } from '@/lib/plaid';
import type { Category, SharingPrefs, Transaction } from '@/types/models';

type AddManualParams = {
  amountMinor: number;
  date: string;
  merchant: string;
  categoryId: string;
  note?: string;
};

type TransactionsContextValue = {
  txns: Transaction[];
  categories: Category[];
  partnerSharing: SharingPrefs | null;
  hiddenAccountIds: Set<string>;
  visible: (mode: 'mine' | 'ours') => Transaction[];
  refresh: () => Promise<void>;
  addManual: (params: AddManualParams) => Promise<string>;
};

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const { user, household, refreshHousehold } = useAuth();
  const { isPremium, refresh: refreshPremium } = usePremium();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [partnerSharing, setPartnerSharing] = useState<SharingPrefs | null>(null);
  const [hiddenAccountIds, setHiddenAccountIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!household?.id) return;
    void fetchCategories(household.id).then(setCategories);
  }, [household?.id]);

  useEffect(() => {
    if (!household?.id || !user) {
      setTxns([]);
      return;
    }
    const unsub = listenTransactions({
      householdId: household.id,
      uid: user.uid,
      isPremium,
      onData: setTxns,
      onError: (e) => console.warn('[Transactions]', e),
    });
    return unsub;
  }, [household?.id, user, isPremium]);

  useEffect(() => {
    if (!household?.id) return;
    return listenBankAccounts(household.id, (accounts) => {
      setHiddenAccountIds(new Set(accounts.filter((a) => a.isHidden).map((a) => a.id)));
    });
  }, [household?.id]);

  useEffect(() => {
    if (!household || !user) return;
    const partnerId = household.memberIds.find((id) => id !== user.uid);
    if (!partnerId) {
      setPartnerSharing(null);
      return;
    }
    void getSharingPrefs(partnerId, household.id).then(setPartnerSharing);
  }, [household, user]);

  const refresh = useCallback(async () => {
    if (!user || !household) return;
    await Promise.all([
      refreshHousehold(),
      refreshPremium(),
      fetchCategories(household.id).then(setCategories),
      (async () => {
        const partnerId = household.memberIds.find((id) => id !== user.uid);
        if (!partnerId) {
          setPartnerSharing(null);
          return;
        }
        setPartnerSharing(await getSharingPrefs(partnerId, household.id));
      })(),
      isPremium ? syncPlaidTransactions().catch(() => null) : Promise.resolve(null),
    ]);
  }, [user, household, isPremium, refreshHousehold, refreshPremium]);

  const addManual = useCallback(
    async (params: AddManualParams) => {
      if (!user || !household) throw new Error('Sign in required');
      const prefs = await getSharingPrefs(user.uid, household.id);
      return createManualTransaction({
        householdId: household.id,
        uid: user.uid,
        amountMinor: params.amountMinor,
        currency: household.defaultCurrency,
        date: params.date,
        merchant: params.merchant,
        categoryId: params.categoryId,
        note: params.note,
        shareTransactions: prefs?.shareTransactions ?? false,
      });
    },
    [user, household],
  );

  const visible = useCallback(
    (mode: 'mine' | 'ours') => {
      if (!user) return [];
      return filterVisibleTransactions({
        txns,
        uid: user.uid,
        mode,
        partnerSharing,
        hiddenAccountIds,
      });
    },
    [txns, user, partnerSharing, hiddenAccountIds],
  );

  const value = useMemo<TransactionsContextValue>(
    () => ({
      txns,
      categories,
      partnerSharing,
      hiddenAccountIds,
      visible,
      refresh,
      addManual,
    }),
    [txns, categories, partnerSharing, hiddenAccountIds, visible, refresh, addManual],
  );

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
}

export function useTransactions() {
  const ctx = useContext(TransactionsContext);
  if (!ctx) throw new Error('useTransactions outside TransactionsProvider');
  return ctx;
}
