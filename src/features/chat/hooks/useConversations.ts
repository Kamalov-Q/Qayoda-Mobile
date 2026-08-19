import { useQuery } from "@tanstack/react-query";
import { chatApi } from "../api/chat.api";

export function useConversations() {
  return useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: chatApi.listConversations,
    staleTime: 15_000,
  });
}

export function useUnreadTotal(): number {
  const { data } = useConversations();

  return data?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0;
}
