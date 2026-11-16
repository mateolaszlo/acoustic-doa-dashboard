import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../types/api_types.js';
import { extractApiErrorMessage, formatClientError } from '../services/error_messages.js';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  sessionError: string | null;
  clearSessionError: () => void;
  refreshSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  isAuthenticated: false,
  isAdmin: false,
  sessionError: null,
  clearSessionError: () => {},
  refreshSession: async () => {},
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const clearSessionError = useCallback(() => setSessionError(null), []);

  const verifySession = useCallback(async (isCancelled?: () => boolean) => {
    try {
      const res = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });

      if (isCancelled?.()) return;

      if (res.ok) {
        const data = await res.json();
        if (isCancelled?.()) return;
        setUser(data?.user ?? null);
        setSessionError(null);
        return;
      }

      if (res.status === 401 || res.status === 403) {
        setUser(null);
        return;
      }

      setUser(null);
      const msg = await extractApiErrorMessage(res, 'Unable to verify your session.');
      if (!isCancelled?.()) {
        setSessionError(msg);
      }
    } catch (err) {
      if (!isCancelled?.()) {
        setUser(null);
        setSessionError(formatClientError(err, 'Unable to reach the authentication server.'));
      }
    }
  }, []);

  // Verify existing HttpOnly cookie session on initial load (no localStorage token storage)
  useEffect(() => {
    let cancelled = false;

    // Purge any legacy client-accessible auth storage keys if present
    try {
      localStorage.removeItem('acoustic_auth_token');
      localStorage.removeItem('acoustic_auth_user');
    } catch {}

    verifySession(() => cancelled).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [verifySession]);

  const refreshSession = useCallback(async () => {
    await verifySession();
  }, [verifySession]);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const message = await extractApiErrorMessage(res, 'Sign-in failed.');
        return { success: false, error: message };
      }

      const data = await res.json();
      if (!data?.user) {
        return { success: false, error: 'Server returned an incomplete login response.' };
      }

      setUser(data.user);
      setSessionError(null);
      return { success: true };
    } catch (err) {
      return { success: false, error: formatClientError(err, 'Unable to sign in right now.') };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) {
        const message = await extractApiErrorMessage(res, 'Registration failed.');
        return { success: false, error: message };
      }

      const data = await res.json();
      if (!data?.user) {
        return { success: false, error: 'Server returned an incomplete registration response.' };
      }

      setUser(data.user);
      setSessionError(null);
      return { success: true };
    } catch (err) {
      return { success: false, error: formatClientError(err, 'Unable to create account right now.') };
    }
  };

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Clear local session state even if network request fails
    } finally {
      setUser(null);
      setSessionError(null);
    }
  }, []);

  const isAuthenticated = Boolean(user);
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token: null,
        loading,
        isAuthenticated,
        isAdmin,
        sessionError,
        clearSessionError,
        refreshSession,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
