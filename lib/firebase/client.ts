'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig, useEmulator } from './config';

let auth: Auth | null = null;
let db: Firestore | null = null;

function app() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function clientAuth() {
  if (!auth) {
    auth = getAuth(app());
    auth.languageCode = 'pt-BR';
    if (useEmulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return auth;
}

export function clientDb() {
  if (!db) {
    db = getFirestore(app());
    if (useEmulator) connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return db;
}
