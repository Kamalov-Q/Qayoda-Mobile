// src/features/auth/hooks/useIdentities.ts
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { authApi, AuthProvider } from "../api/auth.api";

import { queryClient } from "../../../lib/query-client";
import { toast } from "../../../components/ui/Toast";
import { errorMessage } from "../../../lib/api-error";

export const IDENTITIES_KEY = ["auth", "identities"] as const;

export function useIdentities() {
  return useQuery({ queryKey: IDENTITIES_KEY, queryFn: authApi.identities });
}

const refresh = () => queryClient.invalidateQueries({ queryKey: IDENTITIES_KEY });


/** The Telegram handshake needs its own screen; this just opens it in link mode. */
export function linkTelegram() {
  router.push({ pathname: "/telegram", params: { link: "1" } });
}

export function useUnlink() {
  return useMutation({
    mutationFn: (provider: AuthProvider) => authApi.unlink(provider),
    onSuccess: () => {
      refresh();
      // The session user carries phone/email; unlinking clears them.
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.successKey("auth.unlinked");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
