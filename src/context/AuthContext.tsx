import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser } from '../types/api_types.js';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isAdmin: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('acoustic_auth_token'));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('acoustic_auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Verify session on mount if token exists
  useEffect(() => {
    if (!token) return;

    fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Token expired');
      })
      .then((data) => {
        setUser(data.user);
        localStorage.setItem('acoustic_auth_user', JSON.stringify(data.user));
      })
      .catch(() => {
        logout();
      });
  }, [token]);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error?.message || 'Authentication failed' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('acoustic_auth_token', data.token);
      localStorage.setItem('acoustic_auth_user', JSON.stringify(data.user));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error' };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error?.message || 'Registration failed' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('acoustic_auth_token', data.token);
      localStorage.setItem('acoustic_auth_user', JSON.stringify(data.user));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('acoustic_auth_token');
    localStorage.removeItem('acoustic_auth_user');
  };

  const isAuthenticated = Boolean(user && token);
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
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
