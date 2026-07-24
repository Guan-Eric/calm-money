import {
  doc,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_CATEGORIES, type AppUser, type Household, type SharingPrefs } from '@/types/models';
import { deviceCountryCode, deviceCurrencyCode, deviceLocale } from '@/lib/money';

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function bootstrapUserProfile(params: {
  uid: string;
  email: string | null;
  displayName: string | null;
}): Promise<{ user: AppUser; household: Household }> {
  const userRef = doc(db, 'users', params.uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    const data = existing.data() as AppUser;
    const householdSnap = await getDoc(doc(db, 'households', data.householdId));
    return {
      user: { ...data, uid: params.uid },
      household: { id: data.householdId, ...(householdSnap.data() as Omit<Household, 'id'>) },
    };
  }

  const householdId = newId('hh');
  const now = Date.now();
  const countryCode = deviceCountryCode();
  const defaultCurrency = deviceCurrencyCode();
  const locale = deviceLocale();

  const household: Household = {
    id: householdId,
    memberIds: [params.uid],
    createdAt: now,
    countryCode,
    defaultCurrency,
  };

  const user: AppUser = {
    uid: params.uid,
    email: params.email,
    displayName: params.displayName,
    householdId,
    locale,
    expoPushToken: null,
    notificationPrefs: {
      syncComplete: true,
      weeklyDigest: false,
      partnerInvite: true,
    },
    createdAt: now,
  };

  const sharing: SharingPrefs = {
    id: `${params.uid}_${householdId}`,
    householdId,
    userId: params.uid,
    shareTransactions: false,
    shareAccountIds: [],
    displayNameInHousehold: params.displayName,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'households', householdId), {
    memberIds: household.memberIds,
    createdAt: household.createdAt,
    countryCode: household.countryCode,
    defaultCurrency: household.defaultCurrency,
  });
  batch.set(userRef, {
    email: user.email,
    displayName: user.displayName,
    householdId: user.householdId,
    locale: user.locale,
    expoPushToken: null,
    notificationPrefs: user.notificationPrefs,
    createdAt: user.createdAt,
  });
  batch.set(doc(db, 'sharingPrefs', sharing.id), sharing);

  for (const cat of DEFAULT_CATEGORIES) {
    const catId = newId('cat');
    batch.set(doc(db, 'categories', catId), {
      householdId,
      nameKey: cat.nameKey,
      color: cat.color,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
    });
  }

  await batch.commit();
  return { user, household };
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<AppUser, 'uid'>) };
}
