import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { chatApi, ChatMessage } from "../api/chat.api";
import { queryClient } from "@/src/lib/query-client";

export function useMessages(conversationId: string) {
  const [loadingMore, setLoadingMore] = useState(false);
  const exhausted = useRef(false);

  const query = useQuery({
    queryKey: ["chat", "messages", conversationId],
    queryFn: () => chatApi.listMessages(conversationId),
    staleTime: Infinity,
  });

  const loadOlder = useCallback(async () => {
    const current = queryClient.getQueryData<ChatMessage[]>([
      "chat",
      "messages",
      conversationId,
    ]);

    if (!current?.length || exhausted.current || loadingMore) return;

    setLoadingMore(true);

    try {
      const oldest = current[current.length - 1];
      const page = await chatApi.listMessages(conversationId, oldest.createdAt);
      if (page.length === 0) {
        exhausted.current = true;
      } else {
        queryClient.setQueryData<ChatMessage[]>(
          ["chat", "messages", conversationId],
          (old) => [...(old ?? []), ...page],
        );
      }
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore]);

  return { ...query, loadOlder, loadingMore };
}
