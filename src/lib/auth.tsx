import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import type { User, AuthContextType } from './types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  async function login(username: string, password: string) {
    setLoading(true);
    try {
      // Query users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !data) {
        throw new Error('User not found');
      }

      // Simple password check (in production, use bcrypt)
      if (data.password !== password) {
        throw new Error('Invalid password');
      }

      // Store user in localStorage and state
      const userData = {
        id: data.id,
        username: data.username,
        password: data.password,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
