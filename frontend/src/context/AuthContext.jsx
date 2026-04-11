import { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';

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

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        localStorage.setItem('user_token', currentUser.uid);
      } else {
        localStorage.removeItem('user_token');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error("Firebase Login Error", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Firebase Logout Error", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loginWithGoogle, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
