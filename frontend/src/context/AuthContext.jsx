import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, onAuthLost, tokens } from '../lib/api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokens.access() || tokens.refresh()));

  /* Restore the session on load. A stored token may be stale, so we verify it
     against /me rather than trusting its presence. */
  useEffect(() => {
    // `loading` already starts false when there is no stored session, so this
    // effect only runs a network check and never flips state synchronously.
    if (!tokens.access() && !tokens.refresh()) return undefined;
    let cancelled = false;
    api.me().then(
      (me) => { if (!cancelled) { setAccount(me); setLoading(false); } },
      () => {
        if (cancelled) return;
        tokens.clear();
        setAccount(null);
        setLoading(false);
      },
    );
    return () => { cancelled = true; };
  }, []);

  /* The API client signals when a refresh failed, so a revoked session logs out
     everywhere instead of leaving the UI in a half-authenticated state. */
  useEffect(() => onAuthLost(() => setAccount(null)), []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    tokens.set(data);
    setAccount(data.account);
    return data.account;
  }, []);

  const signup = useCallback(async (email, password, displayName) => {
    const data = await api.signup(email, password, displayName);
    tokens.set(data);
    setAccount(data.account);
    return data.account;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setAccount(null);
  }, []);

  const saveProfile = useCallback(async (patch) => {
    const profile = await api.updateProfile(patch);
    setAccount((prev) => (prev ? { ...prev, profile } : prev));
    return profile;
  }, []);

  const value = useMemo(
    () => ({
      account,
      profile: account?.profile ?? null,
      loading,
      isAuthed: Boolean(account),
      onboarded: Boolean(account?.profile?.onboarded),
      login,
      signup,
      logout,
      saveProfile,
    }),
    [account, loading, login, signup, logout, saveProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
