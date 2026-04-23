import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAYzoiG5XGYQLcYhq4ixBRyF4_l0Gl-1yY",
  authDomain: "news-intel-d1bd3.firebaseapp.com",
  projectId: "news-intel-d1bd3",
  storageBucket: "news-intel-d1bd3.firebasestorage.app",
  messagingSenderId: "1004594979390",
  appId: "1:1004594979390:web:f0556c95f24ae3bb3ba76f",
  measurementId: "G-P1NE08PN3M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export { auth, googleProvider, signInWithPopup, signOut };
