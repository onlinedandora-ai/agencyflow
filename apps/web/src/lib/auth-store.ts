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

const AUTH_STORE_KEY = "__agencyflow_auth_store__";

function initAuthStore() {
  return create<AuthState>()(
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
        skipHydration: true,
        partialize: (state) => ({ token: state.token, user: state.user }),
        merge: (persistedState, currentState) => {
          const persisted = persistedState as Partial<Pick<AuthState, "token" | "user">> | undefined;
          return {
            ...currentState,
            token: currentState.token ?? persisted?.token ?? null,
            user: currentState.user ?? persisted?.user ?? null,
          };
        },
        onRehydrateStorage: () => () => {
          getAuthStore().setState({ _hasHydrated: true });
        },
      },
    ),
  );
}

type AuthStore = ReturnType<typeof initAuthStore>;

const globalWithStore = globalThis as typeof globalThis & {
  [AUTH_STORE_KEY]?: AuthStore;
};

function getAuthStore(): AuthStore {
  if (!globalWithStore[AUTH_STORE_KEY]) {
    globalWithStore[AUTH_STORE_KEY] = initAuthStore();
  }
  return globalWithStore[AUTH_STORE_KEY];
}

/** Singleton — Next.js can bundle this module into multiple chunks; share one store. */
export const useAuthStore = getAuthStore();
