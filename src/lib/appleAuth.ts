import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { FirebaseError } from 'firebase/app';
import { OAuthProvider, signInWithCredential, updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

/** Set before Firebase credential sign-in so bootstrap can read Apple's one-time name. */
let pendingAppleDisplayName: string | null = null;

export function takePendingAppleDisplayName(): string | null {
  const name = pendingAppleDisplayName;
  pendingAppleDisplayName = null;
  return name;
}

function formatAppleFullName(
  name: AppleAuthentication.AppleAuthenticationFullName | null | undefined,
): string | null {
  if (!name) return null;
  const parts = [name.givenName, name.middleName, name.familyName].filter(Boolean);
  const joined = parts.join(' ').trim();
  return joined || null;
}

async function persistAppleDisplayName(uid: string, displayName: string) {
  const userRef = doc(db, 'users', uid);
  for (let attempt = 0; attempt < 8; attempt++) {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (!data.displayName) {
        await updateDoc(userRef, { displayName });
      }
      const householdId = data.householdId as string | undefined;
      if (householdId) {
        const prefsRef = doc(db, 'sharingPrefs', `${uid}_${householdId}`);
        const prefsSnap = await getDoc(prefsRef);
        if (prefsSnap.exists() && !prefsSnap.data().displayNameInHousehold) {
          await updateDoc(prefsRef, { displayNameInHousehold: displayName });
        }
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** Apple JWT `aud` is the running binary's bundle ID — Expo Go is always host.exp.Exponent. */
export function appleSignInBlockedReason(): string | null {
  if (Platform.OS !== 'ios') return 'Apple Sign-In is only available on iOS.';
  if (isExpoGo()) {
    return 'Sign in with Apple needs a Tally development build (not Expo Go). Run `npx expo run:ios` or an EAS dev client.';
  }
  return null;
}

async function randomNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

export function formatAppleAuthError(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
    return '';
  }
  const blocked = appleSignInBlockedReason();
  if (blocked) return blocked;

  const message = e instanceof Error ? e.message : String(e);
  const code = e instanceof FirebaseError ? e.code : undefined;
  const lower = message.toLowerCase();

  if (code === 'auth/invalid-credential' || lower.includes('audience') || lower.includes('id token')) {
    return 'Apple Sign-In is misconfigured. In Firebase Auth → Apple, set Service ID to the iOS bundle ID com.calmmoney.app (the token audience), enable Sign in with Apple on that App ID, and rebuild the dev client. See scripts/apple-signin-checklist.sh.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Apple is not enabled as a Firebase sign-in provider. Enable it in Authentication → Sign-in method.';
  }
  if (code === 'auth/admin-restricted-operation') {
    return 'Firebase rejected Apple Sign-In. Confirm the Apple provider, Team ID, and private key in the Firebase console.';
  }
  return message || 'Something went wrong. Try again in a moment.';
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Native Apple Sign-In → Firebase Auth. Returns optional display name (only on first grant). */
export async function signInWithAppleNative(): Promise<{ displayName: string | null }> {
  const blocked = appleSignInBlockedReason();
  if (blocked) throw new Error(blocked);

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error('Apple Sign-In is not available on this device');
  }

  const rawNonce = await randomNonce();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const apple = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!apple.identityToken) {
    throw new Error('Apple did not return an identity token');
  }

  const displayName = formatAppleFullName(apple.fullName);
  pendingAppleDisplayName = displayName;

  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const credential = provider.credential({
    idToken: apple.identityToken,
    rawNonce,
  });

  try {
    const result = await signInWithCredential(auth, credential);

    if (displayName) {
      try {
        if (!result.user.displayName) {
          await updateProfile(result.user, { displayName });
        }
        await persistAppleDisplayName(result.user.uid, displayName);
      } catch {
        // Non-fatal — email-only profile is fine
      }
    }

    return { displayName };
  } catch (e) {
    pendingAppleDisplayName = null;
    throw e;
  }
}
