'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { firebaseConfig, useEmulator } from './config';

let auth: Auth | null = null;

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
