'use client';

import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: { email: string; name: string } | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: { email: string; name: string }) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  setAuth: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('voxpilot_token', token);
      localStorage.setItem('voxpilot_user', JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('voxpilot_token');
      localStorage.removeItem('voxpilot_user');
    }
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('voxpilot_token');
    const userStr = localStorage.getItem('voxpilot_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isAuthenticated: true });
      } catch {
        // Invalid stored data
      }
    }
  },
}));
