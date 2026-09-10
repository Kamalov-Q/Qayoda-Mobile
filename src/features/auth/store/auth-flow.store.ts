import { create } from "zustand";

/**
 * Transient state for the multi-screen phone login: the number entered on the
 * welcome screen is what the code screen verifies and resends to. Cleared the
 * moment a session is established.
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
