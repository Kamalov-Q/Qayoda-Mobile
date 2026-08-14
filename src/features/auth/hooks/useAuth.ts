// src/features/auth/hooks/useAuth.ts
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { authApi, SessionResponse } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import { secureSession } from "../../../lib/secure-session";
import { refreshSession } from "../../../lib/api-client";
import { queryClient } from "../../../lib/query-client";
import { OtpPurpose, useAuthFlowStore } from "../store/auth-flow.store";
import { toast } from "../../../components/ui/Toast";

async function establishSession(session: SessionResponse) {
  await secureSession.saveRefreshToken(session.refreshToken);
  useAuthStore.getState().setSession(session.accessToken, session.user);
  useAuthFlowStore.getState().reset();
  router.replace("/(tabs)/home");
  toast.successKey("auth.loggedIn");
}

export function useRequestOtp() {
  const setRequestId = useAuthFlowStore((s) => s.setRequestId);
  return useMutation({
    mutationFn: (args: { email: string; purpose: OtpPurpose }) =>
      authApi.requestOtp(args.email, args.purpose),
    onSuccess: (data) => {
      setRequestId(data.requestId);
      router.push("/(auth)/verify-otp");
      toast.successKey("auth.otpSent");
    },
  });
}

export function useResendOtp() {
  const setRequestId = useAuthFlowStore((s) => s.setRequestId);
  return useMutation({
    mutationFn: (args: { email: string; purpose: OtpPurpose }) =>
      authApi.requestOtp(args.email, args.purpose),
    onSuccess: (data) => setRequestId(data.requestId),
  });
}

export function useVerifyOtp() {
  const { requestId, purpose, setVerificationToken } = useAuthFlowStore();

  return useMutation({
    mutationFn: async (code: string) => {
      const { verificationToken } = await authApi.verifyOtp(requestId!, code);
      setVerificationToken(verificationToken);

      if (purpose === "LOGIN") {
        const session = await authApi.loginWithOtp(verificationToken);
        await establishSession(session);
        return { done: true as const };
      }
      return { done: false as const };
    },
    onSuccess: (result) => {
      if (!result.done) router.push("/(auth)/register-details");
    },
  });
}

export function useRegister() {
  const verificationToken = useAuthFlowStore((s) => s.verificationToken);
  return useMutation({
    mutationFn: (args: { name: string; surname: string; password: string }) =>
      authApi.register(
        verificationToken!,
        args.name,
        args.surname,
        args.password,
      ),
    onSuccess: establishSession,
  });
}

export function useLoginWithPassword() {
  return useMutation({
    mutationFn: (args: { email: string; password: string }) =>
      authApi.loginWithPassword(args.email, args.password),
    onSuccess: establishSession,
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      // Must run before the store is cleared: the request is authorised with
      // the access token still held there. A failure here is not fatal to the
      // local logout — the device is signed out either way — so it stays
      // swallowed, but it is no longer expected to fail.
      await authApi.logout().catch(() => {});
      await secureSession.clear();
      useAuthStore.getState().clear();
      queryClient.clear(); // wipe cached personal data on logout — cheap and prevents cross-account leaks
    },
    onSuccess: () => {
      router.replace("/(auth)/welcome");
      toast.successKey("auth.loggedOut");
    },
  });
}

/** Cold-start silent refresh — reuses the same single-flight path as 401 handling */
export async function bootstrapSession() {
  const ok = await refreshSession();
  if (!ok) useAuthStore.getState().setUnauthenticated();
}
