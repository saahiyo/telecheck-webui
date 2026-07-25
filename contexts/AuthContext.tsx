'use client';

import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { 
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';

export interface AuthContextType {
  user: User | null;
  idToken: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isFirebaseConfigured();

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

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          // Get fresh ID token for API calls
          const token = await currentUser.getIdToken(true);
          setIdToken(token);
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
    if (auth) {
      try {
        await firebaseSignOut(auth);
        setUser(null);
        setIdToken(null);
      } catch (error: any) {
        console.error('Sign out failed:', error.message);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        loading,
        signOut: handleSignOut,
        isConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
