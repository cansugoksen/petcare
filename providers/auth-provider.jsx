import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { ensureUserDoc } from '@/lib/petcare-db';

const AuthContext = createContext({
  user: null,
  initializing: true,
  error: null,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);

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

  return <AuthContext.Provider value={{ user, initializing, error }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
