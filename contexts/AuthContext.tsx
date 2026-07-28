'use client';

import React, { createContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { 
  User,
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { getFirebaseAuth, getGoogleProvider, isFirebaseConfigured } from '@/lib/firebase';
import { clearCache, fetchMyProfile } from '@/services/api';

export interface AuthContextType {
  user: User | null;
  idToken: string | null;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  isConfigured: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isFirebaseConfigured();

  const getIdToken = useCallback(async (): Promise<string | null> => {
    const currentUser = getFirebaseAuth()?.currentUser;
    if (!currentUser) return null;

    try {
      const token = await currentUser.getIdToken();
      setIdToken(token);
      return token;
    } catch (error: any) {
      console.error('Failed to refresh Firebase ID token:', error.message);
      setIdToken(null);
      return null;
    }
  }, []);

  useEffect(() => {
    // If Firebase isn't configured, skip auth setup
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setIdToken(token);
          // Claim the legacy browser/device contributor on the first sign-in.
          // The API verifies this token and will never let another Firebase UID
          // take over an already-linked contributor.
          clearCache('profile:');
          await fetchMyProfile({ authToken: token, firebaseUid: currentUser.uid });
        } catch (error: any) {
          console.error('Failed to get ID token:', error.message);
          setIdToken(null);
        }
      } else {
        setIdToken(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [isConfigured]);

  const handleSignOut = async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    try {
      await firebaseSignOut(auth);
      setUser(null);
      setIdToken(null);
    } catch (error: any) {
      console.error('Sign out failed:', error.message);
      throw error;
    }
  };

  const handleSignInWithGoogle = async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase Auth is not initialized.');

    try {
      const provider = getGoogleProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Google sign-in failed:', error.message);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        loading,
        getIdToken,
        signOut: handleSignOut,
        signInWithGoogle: handleSignInWithGoogle,
        isConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
