import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';

const ENTITLEMENT_ID = 'premium';

let configured = false;

export function configurePurchases() {
  if (configured) return;
  const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  const apiKey = Platform.OS === 'ios' ? iosKey : androidKey;
  if (!apiKey || apiKey.includes('YOUR_')) {
    console.warn('[RevenueCat] Missing public API key — premium features use mock/free mode.');
    return;
  }
  try {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey });
    configured = true;
  } catch (e) {
    console.warn('[RevenueCat] configure failed (expected in Expo Go):', e);
  }
}

export async function identifyPurchasesUser(uid: string) {
  if (!configured) return;
  try {
    await Purchases.logIn(uid);
  } catch (e) {
    console.warn('[RevenueCat] logIn failed:', e);
  }
}

export async function logoutPurchases() {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    /* anonymous already */
  }
}

export function hasPremium(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return Boolean(info.entitlements.active[ENTITLEMENT_ID]);
}

/** Dev override when keys missing — never treat as real entitlement in production builds. */
export function mockPremiumAllowed(): boolean {
  return process.env.EXPO_PUBLIC_MOCK_PREMIUM === 'true';
}

export { ENTITLEMENT_ID, Purchases };
