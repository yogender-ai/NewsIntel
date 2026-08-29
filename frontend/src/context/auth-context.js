import { createContext, useContext } from 'react';

/* Kept separate from AuthContext.jsx so that file exports only components,
   which keeps React Fast Refresh working during development. */
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
