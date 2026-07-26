import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
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
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS');
  }
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error('Apple Sign-In is not available on this device');
  }

  const rawNonce = Crypto.randomUUID().replace(/-/g, '');
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

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
