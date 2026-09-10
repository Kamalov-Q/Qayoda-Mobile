import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../auth/store/auth.store";
import { chatApi } from "../api/chat.api";

export function useConversations() {
  const authed = useAuthStore((s) => s.status === "authenticated");
  return useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: chatApi.listConversations,
    staleTime: 15_000,
    // Guests have no inbox; firing this signed-out only burns the 401 path.
    enabled: authed,
  });
}

export function useUnreadTotal(): number {
  const { data } = useConversations();

  return data?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0;
}
