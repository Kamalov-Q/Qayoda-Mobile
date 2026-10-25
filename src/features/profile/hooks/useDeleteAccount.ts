// src/features/profile/hooks/useDeleteAccount.ts
// Deleting your own account, and the teardown that has to follow it.
//
// The teardown mirrors useLogout deliberately, and cannot simply call it: by
// the time this succeeds the server has already revoked every refresh token,
// so useLogout's POST /auth/logout would answer 401 and the socket would keep
// streaming into a dead account while that round trip failed.
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { profileApi } from "../api/profile.api";
import { useAuthStore } from "../../auth/store/auth.store";
import { secureSession } from "../../../lib/secure-session";
import { queryClient } from "../../../lib/query-client";
import { disconnectChatSocket } from "../../../lib/chat-socket";
import { toast } from "../../../components/ui/Toast";
import { errorMessage } from "../../../lib/api-error";

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (reason?: string) => {
      await profileApi.deleteAccount(reason);

      // Order matters, and it is the same order logout uses: the socket
      // authenticates with the access token still in the store, so dropping
      // it after the store is cleared would leave it reconnecting.
      disconnectChatSocket();
      await secureSession.clear();
      useAuthStore.getState().clear();
      queryClient.clear();
    },
    onSuccess: () => {
      // Browsing is public, so there is somewhere to land. Replace, not push:
      // nothing behind this screen belongs to anyone any more.
      router.replace("/(tabs)/home");
      toast.successKey("deleteAccount.done");
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });
}
