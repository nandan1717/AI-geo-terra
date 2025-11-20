import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";

// !!! IMPORTANT: REPLACE WITH YOUR FIREBASE CONFIGURATION !!!
// 1. Go to console.firebase.google.com
// 2. Create a project
// 3. Add a Web App
// 4. Copy the config object below
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Check if the config is still using placeholders
const isPlaceholderConfig = firebaseConfig.apiKey === "YOUR_API_KEY_HERE";

let auth: any;
let googleProvider: any;

if (!isPlaceholderConfig) {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
    } catch (e) {
        console.warn("Firebase initialization error:", e);
    }
} else {
    console.log("Running in Demo Mode (No Firebase Config detected)");
}

export const signInWithGoogle = async (): Promise<User | null> => {
  // If auth is not initialized (because of placeholder keys), use Mock Auth
  if (!auth) {
    console.log("Simulating Google Login...");
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    return {
        uid: "demo-user-" + Math.random().toString(36).substr(2, 9),
        displayName: "Traveler (Simulated)",
        email: "demo@terravision.ai",
        photoURL: `https://ui-avatars.com/api/?name=Traveler&background=0D8ABC&color=fff`,
        emailVerified: true,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: "",
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => "mock-token",
        getIdTokenResult: async () => ({
            token: "mock-token",
            signInProvider: "google",
            claims: {},
            authTime: new Date().toISOString(),
            issuedAtTime: new Date().toISOString(),
            expirationTime: new Date().toISOString(),
        }),
        reload: async () => {},
        toJSON: () => ({})
    } as unknown as User;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Login failed", error);
    throw error;
  }
};

export const logout = async () => {
  if (!auth) {
      // Mock logout
      return;
  }
  await signOut(auth);
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  if (!auth) {
    // In mock mode, we don't have persistent listeners. 
    // The app handles the initial user state via the login promise.
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const isMockMode = () => isPlaceholderConfig;