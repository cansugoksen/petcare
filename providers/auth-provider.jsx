import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { migrateLocalDataToFirestore } from '@/lib/local-data-migration';
import { ensureUserDoc, subscribeUserDoc } from '@/lib/petcare-db';

const AuthContext = createContext({
  user: null,
  userProfile: null,
  profileLoading: true,
  initializing: true,
  error: null,
  authBusy: false,
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  resetPassword: async () => {},
  signOutUser: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const migratedUidRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    let profileUnsubscribe = () => {};

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (cancelled) {
        return;
      }

      profileUnsubscribe?.();
      setUser(nextUser);
      setUserProfile(null);
      setProfileLoading(!!nextUser?.uid);

      if (nextUser?.uid) {
        try {
          await ensureUserDoc(nextUser.uid, {
            email: nextUser.email || null,
            displayName: nextUser.displayName || null,
            photoURL: nextUser.photoURL || null,
            isAnonymous: !!nextUser.isAnonymous,
            providerIds: Array.isArray(nextUser.providerData)
              ? nextUser.providerData.map((p) => p?.providerId).filter(Boolean)
              : [],
          });

          profileUnsubscribe = subscribeUserDoc(
            nextUser.uid,
            (profile) => {
              if (cancelled) return;
              setUserProfile(profile);
              setProfileLoading(false);

              if (migratedUidRef.current !== nextUser.uid) {
                migratedUidRef.current = nextUser.uid;
                migrateLocalDataToFirestore({ uid: nextUser.uid, userProfile: profile }).catch((migrationError) => {
                  console.warn('Local->Firestore migration failed:', migrationError);
                });
              }
            },
            (err) => {
              if (cancelled) return;
              setError(err);
              setProfileLoading(false);
            }
          );
        } catch (err) {
          setError(err);
          setProfileLoading(false);
        }
      } else {
        setProfileLoading(false);
      }

      setInitializing(false);
    });

    return () => {
      cancelled = true;
      profileUnsubscribe?.();
      unsubscribe();
    };
  }, []);

  const signInWithEmail = async ({ email, password }) => {
    setAuthBusy(true);
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserDoc(result.user.uid, {
        email: result.user.email || null,
        displayName: result.user.displayName || null,
        photoURL: result.user.photoURL || null,
        isAnonymous: !!result.user.isAnonymous,
      });
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
      const created = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const nextUser = created.user;

      if (trimmedName) {
        await updateProfile(nextUser, { displayName: trimmedName });
      }

      await ensureUserDoc(nextUser.uid, {
        email: nextUser.email || normalizedEmail,
        displayName: trimmedName || nextUser.displayName || null,
        photoURL: nextUser.photoURL || null,
        isAnonymous: !!nextUser.isAnonymous,
      });

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

  const signOutUser = async () => {
    setAuthBusy(true);
    setError(null);
    try {
      await signOut(auth);
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        profileLoading,
        initializing,
        error,
        authBusy,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signOutUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
