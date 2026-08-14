// src/features/auth/store/auth.store.ts
import { create } from "zustand";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  surname: string;
  hasPassword: boolean;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  accessToken: string | null;
  user: SessionUser | null;
  status: AuthStatus;
  setSession: (accessToken: string, user: SessionUser) => void;
  setUnauthenticated: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "loading",
  setSession: (accessToken, user) =>
    set({ accessToken, user, status: "authenticated" }),
  setUnauthenticated: () =>
    set({ accessToken: null, user: null, status: "unauthenticated" }),
  clear: () =>
    set({ accessToken: null, user: null, status: "unauthenticated" }),
}));

// Perf: components must subscribe narrowly —
//   const user = useAuthStore((s) => s.user)        ✅ re-renders only when user changes
//   const store = useAuthStore()                     ❌ re-renders on every token refresh
