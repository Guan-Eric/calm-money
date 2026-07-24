import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  OAuthProvider,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { bootstrapUserProfile } from '@/lib/bootstrap';
import {
  configurePurchases,
  identifyPurchasesUser,
  logoutPurchases,
} from '@/lib/purchases';
import { registerForPushNotifications } from '@/lib/notifications';
import type { AppUser, Household } from '@/types/models';

type AuthContextValue = {
  user: User | null;
  profile: AppUser | null;
  household: Household | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshHousehold: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    configurePurchases();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setHousehold(null);
        setLoading(false);
        await logoutPurchases();
        return;
      }
      try {
        const { user: p, household: h } = await bootstrapUserProfile({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
        });
        setProfile(p);
        setHousehold(h);
        await identifyPurchasesUser(u.uid);
        void registerForPushNotifications(u.uid);
      } catch (e) {
        console.warn('[Auth] bootstrap failed:', e);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setProfile({ uid: user.uid, ...(snap.data() as Omit<AppUser, 'uid'>) });
      }
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!profile?.householdId) return;
    const unsub = onSnapshot(doc(db, 'households', profile.householdId), (snap) => {
      if (snap.exists()) {
        setHousehold({ id: snap.id, ...(snap.data() as Omit<Household, 'id'>) });
      }
    });
    return unsub;
  }, [profile?.householdId]);

  const refreshHousehold = async () => {
    if (!profile?.householdId) return;
    const snap = await getDoc(doc(db, 'households', profile.householdId));
    if (snap.exists()) {
      setHousehold({ id: snap.id, ...(snap.data() as Omit<Household, 'id'>) });
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      household,
      loading,
      configured: isFirebaseConfigured,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      signUp: async (email, password) => {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      },
      signInWithApple: async () => {
        if (Platform.OS !== 'ios') throw new Error('Apple Sign-In is only on iOS');
        const raw = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!raw.identityToken) throw new Error('No Apple identity token');
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({
          idToken: raw.identityToken,
        });
        await signInWithCredential(auth, credential);
      },
      signOut: async () => {
        await firebaseSignOut(auth);
      },
      refreshHousehold,
    }),
    [user, profile, household, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
