import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  addDoc,
  orderBy,
  limit,
  deleteDoc,
  getDocs
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAMs0MaziuxSFi9J10L6Zx9udPtTNhBqj8",
  authDomain: "yomai-c53ed.firebaseapp.com",
  projectId: "yomai-c53ed",
  storageBucket: "yomai-c53ed.firebasestorage.app",
  messagingSenderId: "851954980738",
  appId: "1:851954980738:web:cdcdce9e829597da3d619b",
  measurementId: "G-5WNEPEH7H2"
};

const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const auth = getAuth(app);

// Use the applet-specific database ID if available
const databaseId = "ai-studio-c2981c97-b9dd-477a-9b0b-ad95209830fd";
export const db = getFirestore(app, databaseId);
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  addDoc,
  orderBy,
  limit,
  deleteDoc,
  getDocs
};
export type { User };
