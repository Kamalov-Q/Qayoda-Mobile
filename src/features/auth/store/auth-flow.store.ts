import { create } from "zustand";

/**
 * Transient state for the two-screen phone login: the number entered on the
 * welcome screen is what the code screen verifies with. Cleared the moment a
 * session is established.
 *
 * No name here any more. It used to be parked alongside the number and
 * handed to the verify call, back when the welcome screen asked everyone for
 * one; a new account is now asked on /onboarding, after it has a session.
 */
interface AuthFlowState {
  /** Normalized `+998XXXXXXXXX`. */
  phone: string;
  setPhone: (phone: string) => void;
  reset: () => void;
}

export const useAuthFlowStore = create<AuthFlowState>((set) => ({
  phone: "",
  setPhone: (phone) => set({ phone }),
  reset: () => set({ phone: "" }),
}));
