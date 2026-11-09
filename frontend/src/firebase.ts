import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
  ConfirmationResult,
} from 'firebase/auth';

// Firebase configuration using Vite environment variables or fallback sandbox settings
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoKeyForOnnorokomSchoolAuth2027',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'onnorokom-school-admissions.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'onnorokom-school-admissions',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'onnorokom-school-admissions.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '109823456789',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:109823456789:web:abcdef123456789',
};

// Initialize Firebase safely (avoiding multiple initializations)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<{ user: User; idToken: string }> {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return { user: result.user, idToken };
}

export function setupRecaptcha(elementId: string): RecaptchaVerifier {
  return new RecaptchaVerifier(auth, elementId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved - allow signInWithPhoneNumber
    },
  });
}

export async function sendOtpToPhone(
  phoneNumber: string,
  verifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  // Format international +880 phone if entered with 01...
  let formatted = phoneNumber.trim();
  if (formatted.startsWith('01')) {
    formatted = `+880${formatted.substring(1)}`;
  } else if (!formatted.startsWith('+')) {
    formatted = `+880${formatted}`;
  }
  return await signInWithPhoneNumber(auth, formatted, verifier);
}

export async function logoutFirebase(): Promise<void> {
  await fbSignOut(auth);
}

export { onAuthStateChanged };
export type { User, ConfirmationResult };
