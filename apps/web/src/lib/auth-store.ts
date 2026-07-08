"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "./api";

type AuthState = {
  token: string | null;
  user: User | null;
  _hasHydrated: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      _hasHydrated: false,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    {
      name: "agencyflow-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hasHydrated: true });
      },
    },
  ),
);
