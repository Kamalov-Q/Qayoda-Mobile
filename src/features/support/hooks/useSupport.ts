import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  supportApi,
  type SendSupportInput,
  type SupportMessage,
  type SupportThread,
} from "../api/support.api";
import { queryClient } from "@/src/lib/query-client";
import {
  disconnectSupportSocket,
  getSupportSocket,
} from "@/src/lib/support-socket";
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
    // The global 60s staleTime is right for lists that change slowly; a
    // conversation is not one. Messages can arrive while this screen is
    // closed — a forward from a chat, or an answer from the desk — and the
    // socket only listens while it is open.
    staleTime: 0,
    refetchOnMount: "always",
  });

  return query;
}

/**
 * Keeps the support socket connected for as long as someone is signed in.
 *
 * Mounted once in the app shell, not in the support screen: an answer from
 * the desk has to arrive whatever the reader is looking at, or the badge
 * only appears when they happen to open the thread — which is the one moment
 * a badge is no longer any use.
 */
export function useSupportLive() {
  const authed = useAuthStore((s) => s.status === "authenticated");

  useEffect(() => {
    if (!authed) {
      // Signing out must not leave a socket authenticated as the last user.
      disconnectSupportSocket();
      return;
    }

    const socket = getSupportSocket();

    const onMessage = (message: SupportMessage) => {
      queryClient.setQueryData<Thread>(SUPPORT_KEY, (current) =>
        current && !current.messages.some((m) => m.id === message.id)
          ? { ...current, messages: [...current.messages, message] }
          : current,
      );
      // Reading it is what clears the badge; arriving is what raises it.
      void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
    };

    /**
     * The thread itself changed — read, pinned, closed, reopened.
     *
     * Patched in place rather than refetched: the payload IS the new thread,
     * and a round trip to learn what we were just told would leave the ticks
     * a second behind on every read.
     */
    const onThread = (thread: SupportThread) => {
      queryClient.setQueryData<Thread>(SUPPORT_KEY, (current) =>
        current ? { ...current, thread } : current,
      );
      void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
    };

    socket.on("support:message", onMessage);
    socket.on("support:thread", onThread);
    return () => {
      socket.off("support:message", onMessage);
      socket.off("support:thread", onThread);
    };
  }, [authed]);
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
    mutationFn: (input: SendSupportInput) => supportApi.send(input),
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
