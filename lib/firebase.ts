import { initializeApp, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  connectAuthEmulator, 
  Auth,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function initializeFirebase(): FirebaseApp {
  if (firebaseApp) return firebaseApp;

  // Validate that all required config values are present
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
  const missing = requiredKeys.filter(
    key => !firebaseConfig[key]
  );

  if (missing.length > 0) {
    console.warn(
      `Firebase config incomplete. Missing: ${missing.join(', ')}. ` +
      'Add NEXT_PUBLIC_FIREBASE_* env vars to .env.local to enable authentication.'
    );
  }

  try {
    firebaseApp = initializeApp(firebaseConfig);
  } catch (error: any) {
    if (error.code !== 'app/duplicate-app') {
      throw error;
    }
    firebaseApp = getApp();
  }

  return firebaseApp;
}

export function getFirebaseAuth(): Auth | null {
  if (!firebaseApp) {
    initializeFirebase();
  }

  if (firebaseAuth) return firebaseAuth;

  try {
    firebaseAuth = getAuth(firebaseApp!);

    // Set persistence to LOCAL so users stay logged in across sessions
    setPersistence(firebaseAuth, browserLocalPersistence).catch((err) => {
      console.warn('Failed to set auth persistence:', err.message);
    });

    // Enable emulator in development if configured
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST
    ) {
      try {
        connectAuthEmulator(
          firebaseAuth,
          `http://${process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST}`,
          { disableWarnings: true }
        );
        console.log('Firebase Auth Emulator connected');
      } catch (error: any) {
        if (!error.message.includes('already connected')) {
          console.warn('Failed to connect auth emulator:', error.message);
        }
      }
    }

    return firebaseAuth;
  } catch (error: any) {
    console.warn('Failed to initialize Firebase Auth:', error.message);
    return null;
  }
}

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );
}
