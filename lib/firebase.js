import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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
export const firestore = getFirestore(firebaseApp);
