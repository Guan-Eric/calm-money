import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CustomerInfo } from 'react-native-purchases';
import { httpsCallable } from 'firebase/functions';
import {
  Purchases,
  hasPremium,
  mockPremiumAllowed,
  ENTITLEMENT_ID,
} from '@/lib/purchases';
import { useAuth } from '@/providers/AuthProvider';
import { functions } from '@/lib/firebase';

type PremiumContextValue = {
  isPremium: boolean;
  customerInfo: CustomerInfo | null;
  refresh: () => Promise<void>;
  presentPaywallHint: string;
  purchasePackageById: (packageId: string) => Promise<void>;
  restore: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

/** Mirror Pro via Cloud Function (client cannot write isPremium directly). */
async function mirrorPremiumToFirestore(isPremium: boolean) {
  try {
    const fn = httpsCallable(functions, 'syncPremiumStatus');
    await fn({ isPremium });
  } catch (e) {
    console.warn('[Premium] mirror failed:', e);
  }
}

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const refresh = async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch {
      setCustomerInfo(null);
    }
  };

  useEffect(() => {
    if (!user) {
      setCustomerInfo(null);
      return;
    }
    void refresh();
    try {
      const listener = (info: CustomerInfo) => setCustomerInfo(info);
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(listener);
      };
    } catch {
      return undefined;
    }
  }, [user]);

  const isPremium = hasPremium(customerInfo) || mockPremiumAllowed();

  useEffect(() => {
    if (!user) return;
    void mirrorPremiumToFirestore(isPremium);
  }, [user, isPremium]);

  const value = useMemo<PremiumContextValue>(
    () => ({
      isPremium,
      customerInfo,
      refresh,
      presentPaywallHint: `Unlock Tally Pro (${ENTITLEMENT_ID}) for bank sync, sharing, and longer history.`,
      purchasePackageById: async (packageId: string) => {
        const offerings = await Purchases.getOfferings();
        const pkg =
          offerings.current?.availablePackages.find((p) => p.identifier === packageId) ??
          offerings.current?.availablePackages[0];
        if (!pkg) throw new Error('No packages available');
        const { customerInfo: info } = await Purchases.purchasePackage(pkg);
        setCustomerInfo(info);
        await mirrorPremiumToFirestore(hasPremium(info) || mockPremiumAllowed());
      },
      restore: async () => {
        const info = await Purchases.restorePurchases();
        setCustomerInfo(info);
        await mirrorPremiumToFirestore(hasPremium(info) || mockPremiumAllowed());
      },
    }),
    [isPremium, customerInfo, user],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium outside PremiumProvider');
  return ctx;
}
