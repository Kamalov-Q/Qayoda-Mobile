import { create } from "zustand";

/** Mirror of the `user` object every session response carries. */
export interface SessionUser {
  id: string;
  name: string | null;
  surname: string | null;
  /** Set only by passing an SMS code — never typed in. */
  phoneNumber: string | null;
  /** Set only by a Google-verified address. */
  email: string | null;
  avatarUrl: string | null;
  language: "uz" | "ru";
  role: string;
  isVerifiedRealtor: boolean;
  /** Whether phone+password login works for this account. */
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

// Subscribe narrowly — `useAuthStore((s) => s.user)` — never `useAuthStore()`,
// or every token refresh re-renders the caller.
