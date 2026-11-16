import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../types/api_types.js';
import { ApiError, apiRequestJson } from '../services/api_client.js';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  sessionError: string | null;
  clearSessionError: () => void;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  isAdmin: false,
  sessionError: null,
  clearSessionError: () => {},
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const clearSessionError = useCallback(() => setSessionError(null), []);

  // Verify existing HttpOnly cookie session on initial load (no localStorage token storage)
  useEffect(() => {
    let cancelled = false;

    // Purge any legacy client-accessible auth storage keys if present
    try {
      localStorage.removeItem('acoustic_auth_token');
      localStorage.removeItem('acoustic_auth_user');
    } catch {}

    apiRequestJson<{ user?: AuthUser }>('/api/v1/auth/me', {
      fallbackError: 'Unable to verify your session.',
    })
      .then((data) => {
        if (!cancelled) {
          setUser(data?.user ?? null);
          setSessionError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setUser(null);
        if (!(err instanceof ApiError && (err.status === 401 || err.status === 403))) {
          setSessionError(err instanceof Error ? err.message : 'Unable to reach the authentication server.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const submitCredentials = async (
    endpoint: string,
    payload: Record<string, string>,
    incompleteMsg: string,
    fallbackError: string
  ) => {
    try {
      const data = await apiRequestJson<{ user?: AuthUser }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        fallbackError,
      });
      if (!data?.user) {
        return { success: false, error: incompleteMsg };
      }
      setUser(data.user);
      setSessionError(null);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : fallbackError };
    }
  };

  const login = (username: string, password: string) =>
    submitCredentials(
      '/api/v1/auth/login',
      { username, password },
      'Server returned an incomplete login response.',
      'Sign-in failed.'
    );

  const register = (username: string, email: string, password: string) =>
    submitCredentials(
      '/api/v1/auth/register',
      { username, email, password },
      'Server returned an incomplete registration response.',
      'Registration failed.'
    );

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
        loading,
        isAuthenticated,
        isAdmin,
        sessionError,
        clearSessionError,
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
