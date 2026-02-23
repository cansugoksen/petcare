import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBHab2tlCJ2DqWbbN1iWprcqyb7GGnhkTA',
  authDomain: 'petcare-7361d.firebaseapp.com',
  projectId: 'petcare-7361d',
  storageBucket: 'petcare-7361d.firebasestorage.app',
  messagingSenderId: '1037349357728',
  appId: '1:1037349357728:web:ea902e1c990e8a9bf1a1c5',
  measurementId: 'G-7G9F2NTQGC',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = (() => {
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(firebaseApp);
  }
})();

export const firestore = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
