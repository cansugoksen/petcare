import { createContext, useContext, useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { ensureUserDoc } from '@/lib/petcare-db';

const AuthContext = createContext({
  user: null,
  initializing: true,
  error: null,
  authBusy: false,
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  resetPassword: async () => {},
  signOutToAnonymous: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAnonymousAuth() {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setInitializing(false);
        }
      }
    }

    bootstrapAnonymousAuth();

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (cancelled) {
        return;
      }

      setUser(nextUser);

      if (nextUser?.uid) {
        try {
          await ensureUserDoc(nextUser.uid);
        } catch (err) {
          setError(err);
        }
      }

      setInitializing(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signInWithEmail = async ({ email, password }) => {
    setAuthBusy(true);
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      return result.user;
    } finally {
      setAuthBusy(false);
    }
  };

  const signUpWithEmail = async ({ email, password, displayName }) => {
    setAuthBusy(true);
    setError(null);
    try {
      const normalizedEmail = email.trim();
      const trimmedName = displayName?.trim();

      let nextUser;
      if (auth.currentUser?.isAnonymous) {
        const credential = EmailAuthProvider.credential(normalizedEmail, password);
        const linked = await linkWithCredential(auth.currentUser, credential);
        nextUser = linked.user;
      } else {
        const created = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        nextUser = created.user;
      }

      if (trimmedName) {
        await updateProfile(nextUser, { displayName: trimmedName });
        await ensureUserDoc(nextUser.uid, { displayName: trimmedName });
      }

      return nextUser;
    } finally {
      setAuthBusy(false);
    }
  };

  const resetPassword = async (email) => {
    setAuthBusy(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, String(email || '').trim());
    } finally {
      setAuthBusy(false);
    }
  };

  const signOutToAnonymous = async () => {
    setAuthBusy(true);
    setError(null);
    try {
      await signOut(auth);
      await signInAnonymously(auth);
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        error,
        authBusy,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signOutToAnonymous,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
