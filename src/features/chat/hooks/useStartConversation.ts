import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { queryClient } from "../../../lib/query-client";
import { errorMessage } from "../../../lib/api-error";
import { toast } from "../../../components/ui/Toast";
import { chatApi, type SendMessageInput } from "../api/chat.api";

/**
 * The guest's entry into chat, from a listing. The server returns the existing
 * conversation when there already is one for this listing/guest pair, so
 * tapping the button twice reopens the thread rather than forking it.
 */
/**
 * `target` is either the advert being enquired about or the person being
 * written to. One hook rather than two: everything after the request —
 * seeding the header cache, refreshing the inbox, replacing the route — is
 * identical, and the only difference is which endpoint opens the thread.
 */
export type StartTarget =
  | { kind: "listing"; listingId: string }
  | { kind: "direct"; userId: string };

export function useStartConversation(
  target: StartTarget,
  replaceRoute = false,
) {
  return useMutation({
    mutationFn: (message: SendMessageInput) =>
      target.kind === "listing"
        ? chatApi.startConversation(target.listingId, message)
        : chatApi.startDirectConversation(target.userId, message),
    onSuccess: ({ conversation }) => {
      // Seed the thread's header cache so it renders the peer immediately, and
      // let the inbox pick the new row up on its next read.
      queryClient.setQueryData(
        ["chat", "conversation", conversation.id],
        conversation,
      );
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      // From the draft screen the thread REPLACES it — back must return to
      // the listing, not to a stale draft.
      if (replaceRoute) router.replace(`/chat/${conversation.id}`);
      else router.push(`/chat/${conversation.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
