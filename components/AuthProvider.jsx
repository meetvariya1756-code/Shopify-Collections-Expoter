'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchSession = useCallback(async () => {
    // Never read credentials cookie or call /api/auth/session for merchant routes
    const isAdminArea = pathname?.startsWith('/admin') || pathname === '/login';
    if (!isAdminArea) {
      setLoading(false);
      return null;
    }

    try {
      const res = await axios.get('/api/auth/session');
      if (res.data?.authenticated && res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      } else {
        setUser(null);
        return null;
      }
    } catch (err) {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const login = async (username, password) => {
    const res = await axios.post('/api/auth/login', { username, password });
    if (res.data?.success && res.data?.user) {
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.data?.error || 'Login failed');
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshSession: fetchSession,
        isAdmin: user?.role === 'admin'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
