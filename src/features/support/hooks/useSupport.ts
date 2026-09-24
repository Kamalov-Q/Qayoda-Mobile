import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  supportApi,
  type SupportImage,
  type SupportMessage,
} from "../api/support.api";
import { queryClient } from "@/src/lib/query-client";
import { getSupportSocket } from "@/src/lib/support-socket";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";
import { useAuthStore } from "@/src/features/auth/store/auth.store";

const SUPPORT_KEY = ["support", "thread"] as const;
const UNREAD_KEY = ["support", "unread"] as const;

type Thread = Awaited<ReturnType<typeof supportApi.mine>>;

/**
 * The user's support conversation, kept live.
 *
 * New messages arrive over the socket and are appended to the cache rather
 * than triggering a refetch: the whole transcript is already here, and
 * re-reading it to learn one line is the slow way to find out.
 */
export function useSupport() {
  const authed = useAuthStore((s) => s.status === "authenticated");

  const query = useQuery({
    queryKey: SUPPORT_KEY,
    queryFn: supportApi.mine,
    enabled: authed,
  });

  useEffect(() => {
    if (!authed) return;

    const socket = getSupportSocket();
    const onMessage = (message: SupportMessage) => {
      queryClient.setQueryData<Thread>(SUPPORT_KEY, (current) =>
        current && !current.messages.some((m) => m.id === message.id)
          ? { ...current, messages: [...current.messages, message] }
          : current,
      );
      // Reading it is what clears the badge; arriving is not.
      void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
    };

    socket.on("support:message", onMessage);
    return () => {
      socket.off("support:message", onMessage);
    };
  }, [authed]);

  return query;
}

/** The badge on the settings row. Cheap enough to poll on focus. */
export function useSupportUnread(): number {
  const authed = useAuthStore((s) => s.status === "authenticated");
  const { data } = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: supportApi.unread,
    enabled: authed,
    staleTime: 30_000,
  });
  return data?.unread ?? 0;
}

export function useSendSupport() {
  return useMutation({
    mutationFn: ({ body, image }: { body: string; image?: SupportImage }) =>
      supportApi.send(body, image),
    onSuccess: (message) => {
      // Appended here as well as on the socket echo: the sender should see
      // their own line land immediately, and the socket handler de-duplicates
      // by id when the echo arrives.
      queryClient.setQueryData<Thread>(SUPPORT_KEY, (current) =>
        current && !current.messages.some((m) => m.id === message.id)
          ? { ...current, messages: [...current.messages, message] }
          : current,
      );
      // The first message creates the thread, which the cache does not have.
      void queryClient.invalidateQueries({ queryKey: SUPPORT_KEY });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/** Called when the screen opens — being on it is reading it. */
export function useMarkSupportRead() {
  useEffect(() => {
    void supportApi
      .markRead()
      .then(() => queryClient.invalidateQueries({ queryKey: UNREAD_KEY }))
      .catch(() => {});
  }, []);
}
