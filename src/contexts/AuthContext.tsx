import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/services/types';
import { authService } from '@/services/apiService';
import { connectSocket, disconnectSocket } from '@/services/socket';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<string>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('socialsync_token');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const u = await authService.me();
        setUser(u);
      } catch {
        authService.logout();
        setUser(null);
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (user) connectSocket(user.id);
    return () => disconnectSocket();
  }, [user]);

  const login = async (email: string, password: string) => {
    const u = await authService.login(email, password);
    setUser(u);
  };

  const signup = async (email: string, password: string, username: string): Promise<string> => {
    const result = await authService.signup(email, password, username);
    return (result as any).message || 'Account created! Please log in.';
  };

  const logout = () => {
    disconnectSocket();
    authService.logout();
    setUser(null);
  };

  const updateUser = (u: User) => {
    setUser(u);
    const token = localStorage.getItem('socialsync_token');
    if (token) {
      localStorage.setItem('socialsync_user', JSON.stringify(u));
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}