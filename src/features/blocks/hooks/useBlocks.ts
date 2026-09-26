import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { blocksApi } from "../api/blocks.api";
import { queryClient } from "@/src/lib/query-client";
import { errorMessage } from "@/src/lib/api-error";
import { toast } from "@/src/components/ui/Toast";
import { getChatSocket } from "@/src/lib/chat-socket";
import { useAuthStore } from "@/src/features/auth/store/auth.store";

const BLOCKS_KEY = ["blocks"] as const;

export function useBlocks() {
  const authed = useAuthStore((s) => s.status === "authenticated");
  return useQuery({
    queryKey: BLOCKS_KEY,
    queryFn: blocksApi.list,
    enabled: authed,
  });
}

/**
 * Block or unblock, from anywhere.
 *
 * Everything that could be showing this person is invalidated: their profile
 * carries the state, the conversation list hides presence, and the blocked
 * list is the screen you may be looking at while it happens.
 */
export function useToggleBlock() {
  return useMutation({
    mutationFn: ({ userId, block }: { userId: string; block: boolean }) =>
      block ? blocksApi.block(userId) : blocksApi.unblock(userId),
    onSuccess: (_res, { block }) => {
      toast.successKey(block ? "blocks.blocked" : "blocks.unblocked");
      void queryClient.invalidateQueries({ queryKey: BLOCKS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["users", "profile"] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/**
 * Keeps the block list in step across this person's own devices.
 *
 * The blocked party is deliberately not told — the server only broadcasts to
 * the blocker's own room. Blocking someone from a phone and seeing them
 * still listed on a tablet is the kind of thing that makes people doubt the
 * block took.
 */
export function useBlocksLive() {
  const authed = useAuthStore((s) => s.status === "authenticated");

  useEffect(() => {
    if (!authed) return;

    const socket = getChatSocket();
    const onBlock = () => {
      void queryClient.invalidateQueries({ queryKey: BLOCKS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["users", "profile"] });
    };

    socket.on("user:block", onBlock);
    return () => {
      socket.off("user:block", onBlock);
    };
  }, [authed]);
}
