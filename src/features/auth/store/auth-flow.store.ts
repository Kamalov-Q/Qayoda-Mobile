import { create } from "zustand";

export type OtpPurpose =
  | "REGISTER"
  | "LOGIN"
  | "CHANGE_EMAIL"
  | "RESET_PASSWORD";

interface AuthFlowState {
  email: string;
  purpose: OtpPurpose;
  requestId: string | null;
  verificationToken: string | null;
  setEmailAndPurpose: (email: string, purpose: OtpPurpose) => void;
  setRequestId: (id: string) => void;
  setVerificationToken: (token: string) => void;
  reset: () => void;
}

export const useAuthFlowStore = create<AuthFlowState>((set) => ({
  email: "",
  purpose: "LOGIN",
  requestId: null,
  verificationToken: null,
  setEmailAndPurpose: (email, purpose) => set({ email, purpose }),
  setRequestId: (requestId) => set({ requestId }),
  setVerificationToken: (verificationToken) => set({ verificationToken }),
  reset: () =>
    set({
      email: "",
      purpose: "LOGIN",
      requestId: null,
      verificationToken: null,
    }),
}));
